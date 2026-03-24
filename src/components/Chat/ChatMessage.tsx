import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

import type { LocalChatMessage } from '../../types/chat';

type ChatMessageProps = {
  message: LocalChatMessage;
  isThinking?: boolean;
  isStreaming?: boolean;
};

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}

export function ChatMessage({ message, isThinking = false, isStreaming = false }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopied(false), 1500);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className={`group flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[88%] ${isUser ? 'ui-message-user' : `ui-message-assistant ${isThinking ? 'thinking-bubble' : ''} ${isStreaming ? 'streaming' : ''}`}`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <ReactMarkdown>{message.content}</ReactMarkdown>
        )}
        <span
          className="pointer-events-none absolute -bottom-5 left-2 text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: 'var(--text-muted)' }}
        >
          {formatTimestamp(message.timestamp)}
        </span>
        {!isUser && !isThinking ? (
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="absolute -bottom-5 right-0 rounded px-2 py-0.5 text-xs opacity-0 transition-opacity group-hover:opacity-100"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)' }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        ) : null}
      </div>
    </article>
  );
}
