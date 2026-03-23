import { useEffect, useRef } from 'react';

import type { LocalChatMessage } from '../../types/chat';
import { ChatMessage } from './ChatMessage';

type ChatWindowProps = {
  messages: LocalChatMessage[];
  isStreaming: boolean;
};

export function ChatWindow({ messages, isStreaming }: ChatWindowProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-base font-medium text-slate-900">Hi, How can I assist you today?</p>
        <p className="text-xs text-slate-500">Ask about the current page, summarize key points, or request takeaways.</p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <div className="space-y-2">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isStreaming ? <p className="pl-2 text-sm text-slate-500">▊</p> : null}
        <div ref={endRef} />
      </div>
    </div>
  );
}
