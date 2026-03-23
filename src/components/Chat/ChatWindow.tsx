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
    return <div className="min-h-0 flex-1" />;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      <div className="space-y-3">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            isThinking={
              isStreaming &&
              message.role === 'assistant' &&
              message.id === messages[messages.length - 1]?.id
            }
          />
        ))}
        {isStreaming ? <p className="ui-stream-cursor pl-2 text-sm">▊</p> : null}
        <div ref={endRef} />
      </div>
    </div>
  );
}
