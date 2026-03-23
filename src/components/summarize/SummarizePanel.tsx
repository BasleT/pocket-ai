import { useEffect, useRef, useState } from 'react';

import type { ChatPortResponse } from '../../types/chat';
import type { PageContentResult } from '../../types/page';

const STREAM_PORT_NAME = 'ai-stream';
const MODEL_ID = 'llama-3.3-70b-versatile';

function buildSummaryPrompt(page: PageContentResult): string {
  return [
    'Summarize this page in concise bullet points.',
    `Title: ${page.title}`,
    `URL: ${page.url}`,
    `Content:\n${page.content}`,
  ].join('\n\n');
}

type SummarizePanelProps = {
  pageContext: PageContentResult | null;
  onAskFollowUp: (summary: string) => void;
};

export function SummarizePanel({ pageContext, onAskFollowUp }: SummarizePanelProps) {
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  const streamPortRef = useRef<chrome.runtime.Port | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const autoSummarizedUrlRef = useRef<string | null>(null);

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
        setIsLoading(false);
        activeRequestIdRef.current = null;
        return;
      }

      if (message.type === 'CHAT_STREAM_ERROR') {
        setError(message.message);
        setIsLoading(false);
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

  const runSummarize = () => {
    if (!pageContext?.content || isLoading || !streamPortRef.current) {
      return;
    }

    const requestId = crypto.randomUUID();
    activeRequestIdRef.current = requestId;
    setSummary('');
    setError(null);
    setIsLoading(true);

    streamPortRef.current.postMessage({
      type: 'CHAT_STREAM_START',
      requestId,
      modelId: MODEL_ID,
      messages: [
        {
          role: 'system',
          content: 'You produce concise page summaries with bullets and key takeaways.',
        },
        {
          role: 'user',
          content: buildSummaryPrompt(pageContext),
        },
      ],
    });
  };

  useEffect(() => {
    if (!pageContext?.content || !pageContext.url) {
      return;
    }

    if (autoSummarizedUrlRef.current === pageContext.url) {
      return;
    }

    autoSummarizedUrlRef.current = pageContext.url;
    runSummarize();
  }, [pageContext]);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }

    window.setTimeout(() => setCopyState('idle'), 1400);
  };

  if (!pageContext?.content) {
    return (
      <div className="p-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
          No extractable page content yet. Open a standard web page and try again.
        </div>
      </div>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col p-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={runSummarize}
          disabled={isLoading}
          className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
        >
          Summarize this page
        </button>
        {summary ? (
          <>
            <button
              type="button"
              onClick={copySummary}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
            >
              {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={() => onAskFollowUp(summary)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
            >
              Ask follow-up
            </button>
          </>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}

      {summary ? (
        <article className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 whitespace-pre-wrap">
          {summary}
        </article>
      ) : null}
    </section>
  );
}
