import ReactMarkdown from 'react-markdown';

import type { LocalChatMessage } from '../../types/chat';

type ChatMessageProps = {
  message: LocalChatMessage;
};

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <article className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] ${isUser ? 'ui-message-user' : 'ui-message-assistant'}`}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <ReactMarkdown>{message.content}</ReactMarkdown>
        )}
      </div>
    </article>
  );
}
