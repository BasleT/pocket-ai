import ReactMarkdown from 'react-markdown';

import type { LocalChatMessage } from '../../types/chat';

type ChatMessageProps = {
  message: LocalChatMessage;
};

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <article className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] rounded-lg px-3 py-2 text-sm shadow-sm ${
          isUser ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
        }`}
      >
        <ReactMarkdown>{message.content || '...'}</ReactMarkdown>
      </div>
    </article>
  );
}
