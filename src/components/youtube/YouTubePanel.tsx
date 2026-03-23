import { useEffect, useRef, useState } from 'react';

import type { ChatPortResponse } from '../../types/chat';
import type { GetYouTubeContextResponse, YouTubeContextData } from '../../types/youtube';

const STREAM_PORT_NAME = 'ai-stream';
const MODEL_ID = 'llama-3.3-70b-versatile';

function buildVideoPrompt(context: YouTubeContextData): string {
  const transcript = context.transcriptChunks.join('\n');

  return [
    'Summarize this YouTube video in clear bullet points.',
    `Title: ${context.title}`,
    `URL: ${context.url}`,
    `Transcript:\n${transcript}`,
  ].join('\n\n');
}

type YouTubePanelProps = {
  onAskAboutVideo: (text: string) => void;
};

export function YouTubePanel({ onAskAboutVideo }: YouTubePanelProps) {
  const [context, setContext] = useState<YouTubeContextData | null>(null);
  const [isContextLoading, setIsContextLoading] = useState(true);
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamPortRef = useRef<chrome.runtime.Port | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const autoSummaryVideoRef = useRef<string | null>(null);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: STREAM_PORT_NAME });
    streamPortRef.current = port;

    const onMessage = (message: ChatPortResponse) => {
      if (!activeRequestIdRef.current || message.requestId !== activeRequestIdRef.current) {
        return;
      }

      if (message.type === 'CHAT_STREAM_CHUNK') {
        setSummary((previous) => `${previous}${message.chunk}`);
        return;
      }

      if (message.type === 'CHAT_STREAM_DONE') {
        setIsSummarizing(false);
        activeRequestIdRef.current = null;
        return;
      }

      if (message.type === 'CHAT_STREAM_ERROR') {
        setError(message.message);
        setIsSummarizing(false);
        activeRequestIdRef.current = null;
      }
    };

    port.onMessage.addListener(onMessage);
    return () => {
      port.onMessage.removeListener(onMessage);
      port.disconnect();
      streamPortRef.current = null;
    };
  }, []);

  const loadContext = async () => {
    setIsContextLoading(true);
    setError(null);

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'GET_YOUTUBE_CONTEXT',
      })) as GetYouTubeContextResponse;

      if (!response.ok) {
        setError(response.message);
        setContext(null);
        return;
      }

      setContext(response.data);
    } catch {
      setError('Failed to load YouTube context.');
      setContext(null);
    } finally {
      setIsContextLoading(false);
    }
  };

  useEffect(() => {
    void loadContext();
  }, []);

  const summarize = () => {
    if (!context?.hasTranscript || !streamPortRef.current || isSummarizing) {
      return;
    }

    const requestId = crypto.randomUUID();
    activeRequestIdRef.current = requestId;
    setSummary('');
    setError(null);
    setIsSummarizing(true);

    streamPortRef.current.postMessage({
      type: 'CHAT_STREAM_START',
      requestId,
      modelId: MODEL_ID,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes videos from transcript content.',
        },
        {
          role: 'user',
          content: buildVideoPrompt(context),
        },
      ],
    });
  };

  useEffect(() => {
    if (!context?.videoId || !context.hasTranscript) {
      return;
    }

    if (autoSummaryVideoRef.current === context.videoId) {
      return;
    }

    autoSummaryVideoRef.current = context.videoId;
    summarize();
  }, [context]);

  if (isContextLoading) {
    return <p className="p-4 text-xs text-slate-500">Detecting YouTube page context...</p>;
  }

  if (!context?.isYouTubePage) {
    return <p className="p-4 text-xs text-slate-500">Open a YouTube video page to use this panel.</p>;
  }

  if (!context.hasTranscript) {
    return (
      <div className="p-4">
        <p className="text-sm text-slate-700">No transcript is available for this video.</p>
        <button
          type="button"
          onClick={() => {
            void loadContext();
          }}
          className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col p-4">
      <h2 className="text-sm font-semibold text-slate-900">{context.title || 'YouTube video'}</h2>
      <p className="mt-1 truncate text-xs text-slate-500">{context.url}</p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={summarize}
          disabled={isSummarizing}
          className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
        >
          Summarize video
        </button>
        {summary ? (
          <button
            type="button"
            onClick={() => onAskAboutVideo(`Use this YouTube summary as context:\n\n${summary}`)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
          >
            Ask about this video
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}
      {isSummarizing ? <p className="mt-3 text-xs text-slate-500">Generating summary...</p> : null}
      {summary ? (
        <article className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 whitespace-pre-wrap">
          {summary}
        </article>
      ) : null}
    </section>
  );
}
