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
        className={`max-w-[88%] rounded-xl px-3 py-2 text-sm shadow-sm ${
          isUser
            ? 'border border-cyan-500/30 bg-cyan-500/20 text-cyan-50'
            : 'border border-slate-700 bg-slate-900 text-slate-100'
        }`}
      >
        <ReactMarkdown>{message.content || '...'}</ReactMarkdown>
      </div>
    </article>
  );
}
