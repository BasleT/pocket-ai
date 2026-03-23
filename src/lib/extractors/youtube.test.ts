import { describe, expect, it } from 'vitest';

import {
  buildYouTubeSummaryPrompt,
  chunkTranscript,
  extractYouTubeVideoIdFromUrl,
} from './youtube';

describe('extractYouTubeVideoIdFromUrl', () => {
  it('extracts video id from youtube watch url', () => {
    expect(extractYouTubeVideoIdFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
  });

  it('extracts video id from youtu.be url', () => {
    expect(extractYouTubeVideoIdFromUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for non-youtube urls', () => {
    expect(extractYouTubeVideoIdFromUrl('https://example.com/watch?v=123')).toBeNull();
  });
});

describe('chunkTranscript', () => {
  it('splits long transcript into bounded chunks', () => {
    const transcript =
      'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau';

    const chunks = chunkTranscript(transcript, 30);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 30)).toBe(true);
  });
});

describe('buildYouTubeSummaryPrompt', () => {
  it('includes title, url and transcript chunks in the prompt', () => {
    const prompt = buildYouTubeSummaryPrompt({
      title: 'Video title',
      url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
      transcriptChunks: ['chunk A', 'chunk B'],
      wasChunked: true,
    });

    expect(prompt).toContain('Video title');
    expect(prompt).toContain('chunk A');
    expect(prompt).toContain('chunk B');
    expect(prompt).toContain('youtube.com/watch?v=dQw4w9WgXcQ');
  });
});
