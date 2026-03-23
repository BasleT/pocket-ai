import { buildYouTubeSummaryPrompt } from '../../lib/extractors/youtube';
import type { YouTubeContextData } from '../../types/youtube';

type YouTubeSummarizerProps = {
  context: YouTubeContextData;
  isLoading: boolean;
  onRefresh: () => void;
  onSummarize: (prompt: string) => void;
};

export function YouTubeSummarizer({
  context,
  isLoading,
  onRefresh,
  onSummarize,
}: YouTubeSummarizerProps) {
  if (!context.isYouTubePage) {
    return null;
  }

  return (
    <section className="border-b border-slate-200 bg-red-50 px-3 py-2 dark:border-slate-700 dark:bg-red-950/40">
      <p className="text-xs font-medium text-red-800 dark:text-red-200">▶ YouTube video detected</p>
      <p className="mt-0.5 line-clamp-1 text-[11px] text-red-700 dark:text-red-300">{context.title}</p>

      {context.hasTranscript ? (
        <p className="mt-1 text-[11px] text-red-700 dark:text-red-300">
          Transcript ready ({context.transcriptChunks.length} chunks).
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-red-700 dark:text-red-300">No captions available for this video.</p>
      )}

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() =>
            onSummarize(
              buildYouTubeSummaryPrompt({
                title: context.title,
                url: context.url,
                transcriptChunks: context.transcriptChunks,
                wasChunked: context.transcriptChunks.length > 1,
              }),
            )
          }
          disabled={!context.hasTranscript}
          className="rounded-md bg-red-700 px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:bg-red-300"
          aria-label="Summarize current YouTube video"
        >
          Summarize video
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-60 dark:border-red-700 dark:text-red-200"
          aria-label="Refresh YouTube transcript"
        >
          {isLoading ? 'Refreshing...' : 'Refresh transcript'}
        </button>
      </div>
    </section>
  );
}
