import { useCallback, useEffect, useRef, useState } from 'react';

import { PlaySquare } from 'lucide-react';

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
  activePageUrl: string;
  onAskAboutVideo: (text: string) => void;
};

export function YouTubePanel({ activePageUrl, onAskAboutVideo }: YouTubePanelProps) {
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

  const loadContext = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void loadContext();
  }, [activePageUrl, loadContext]);

  useEffect(() => {
    if (!context?.isYouTubePage || context.hasTranscript) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadContext();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [context?.hasTranscript, context?.isYouTubePage, loadContext]);

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
    return <p className="p-4 text-xs ui-subtle">Detecting YouTube page context...</p>;
  }

  if (!context?.isYouTubePage) {
    return (
      <div className="ui-empty p-4">
        <PlaySquare size={32} className="ui-muted" />
        <p className="text-xs ui-subtle">Open a YouTube video page to use this panel.</p>
      </div>
    );
  }

  if (!context.hasTranscript) {
    return (
      <div className="ui-empty p-4">
        <PlaySquare size={32} className="ui-muted" />
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>No transcript is available for this video.</p>
        <button
          type="button"
          onClick={() => {
            void loadContext();
          }}
          className="ui-btn ui-btn-ghost"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col p-4">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        {context.title || 'YouTube video'}
      </h2>
      <p className="mt-1 truncate text-xs ui-subtle">{context.url}</p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={summarize}
          disabled={isSummarizing}
          className="ui-btn ui-btn-accent"
        >
          Summarize video
        </button>
        {summary ? (
          <button
            type="button"
            onClick={() => onAskAboutVideo(`Use this YouTube summary as context:\n\n${summary}`)}
            className="ui-btn ui-btn-ghost"
          >
            Ask about this video
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-xs" style={{ color: '#fb7185' }}>{error}</p> : null}
      {isSummarizing ? <p className="mt-3 text-xs ui-subtle">Generating summary...</p> : null}
      {summary ? (
        <article className="ui-card mt-3 min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap p-4 text-sm">
          {summary}
        </article>
      ) : null}
    </section>
  );
}
