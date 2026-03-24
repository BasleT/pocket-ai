const DEFAULT_TRANSCRIPT_CHUNK_SIZE = 3_200;
const MAX_CHUNKS_IN_PROMPT = 6;

export type YouTubeTranscriptPayload = {
  title: string;
  url: string;
  transcriptChunks: string[];
  wasChunked: boolean;
};

export function extractYouTubeVideoIdFromUrl(url: string): string | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  const host = parsedUrl.hostname.toLowerCase();
  const normalizedHost = host.replace(/^www\./, '');
  const isYouTubeHost =
    normalizedHost === 'youtube.com' ||
    normalizedHost.endsWith('.youtube.com') ||
    normalizedHost === 'youtube-nocookie.com' ||
    normalizedHost.endsWith('.youtube-nocookie.com');

  if (isYouTubeHost) {
    if (parsedUrl.pathname === '/watch') {
      const videoId = parsedUrl.searchParams.get('v');
      return videoId && videoId.length > 0 ? videoId : null;
    }

    if (
      parsedUrl.pathname.startsWith('/shorts/') ||
      parsedUrl.pathname.startsWith('/live/') ||
      parsedUrl.pathname.startsWith('/embed/') ||
      parsedUrl.pathname.startsWith('/v/')
    ) {
      const parts = parsedUrl.pathname.split('/').filter(Boolean);
      return parts[1] ?? null;
    }
  }

  if (normalizedHost === 'youtu.be') {
    const parts = parsedUrl.pathname.split('/').filter(Boolean);
    return parts[0] ?? null;
  }

  return null;
}

export async function fetchTranscriptByVideoId(videoId: string): Promise<string> {
  const { YoutubeTranscript } = await import('youtube-transcript');
  const transcript = await YoutubeTranscript.fetchTranscript(videoId);
  const merged = transcript
    .map((entry) => entry.text.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  return merged;
}

export function chunkTranscript(transcript: string, maxChunkLength = DEFAULT_TRANSCRIPT_CHUNK_SIZE): string[] {
  const words = transcript.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current.length > 0 ? `${current} ${word}` : word;
    if (candidate.length > maxChunkLength && current.length > 0) {
      chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

export function buildYouTubeSummaryPrompt(payload: YouTubeTranscriptPayload): string {
  const chunksToUse = payload.transcriptChunks.slice(0, MAX_CHUNKS_IN_PROMPT);
  const chunkText = chunksToUse.map((chunk, index) => `Chunk ${index + 1}:\n${chunk}`).join('\n\n');

  const truncationNote =
    payload.transcriptChunks.length > MAX_CHUNKS_IN_PROMPT
      ? `\n\nNote: Transcript was truncated to the first ${MAX_CHUNKS_IN_PROMPT} chunks for context limits.`
      : '';

  return [
    'Summarize this YouTube video into key takeaways and a concise bullet list.',
    `Video title: ${payload.title}`,
    `Video URL: ${payload.url}`,
    payload.wasChunked ? 'Transcript was split into chunks for processing.' : 'Transcript fits in one chunk.',
    `Transcript chunks:\n\n${chunkText}${truncationNote}`,
  ].join('\n\n');
}
