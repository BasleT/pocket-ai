import { useEffect, useMemo, useRef, useState } from 'react';

import { storageGet, storageSet } from '../../lib/storage';
import type {
  ChatPortResponse,
  ChatStreamStartMessage,
  ChatModelId,
  LocalChatMessage,
  SerializableModelMessage,
} from '../../types/chat';
import { Skeleton } from '../common/Skeleton';
import { ChatInput } from './ChatInput';
import { ChatMessage } from './ChatMessage';

const CHAT_HISTORY_KEY = 'aiChatHistory';

const isValidRole = (role: string): role is LocalChatMessage['role'] =>
  role === 'user' || role === 'assistant';

const toSerializableMessages = (messages: LocalChatMessage[]): SerializableModelMessage[] =>
  messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

type ChatWindowProps = {
  modelId: ChatModelId;
  contextSystemMessage?: string;
  draftText?: string;
  onDraftTextChange?: (value: string) => void;
  sendRequest?: { id: string; text: string } | null;
  onSendRequestHandled?: (id: string) => void;
};

type RetryContext = {
  conversationMessages: LocalChatMessage[];
};

function buildStreamMessages(
  conversationMessages: LocalChatMessage[],
  contextSystemMessage?: string,
): SerializableModelMessage[] {
  const base = toSerializableMessages(conversationMessages);
  if (!contextSystemMessage) {
    return base;
  }

  return [{ role: 'system', content: contextSystemMessage }, ...base];
}

export function ChatWindow({
  modelId,
  contextSystemMessage,
  draftText,
  onDraftTextChange,
  sendRequest,
  onSendRequestHandled,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryContext, setRetryContext] = useState<RetryContext | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const lastHandledSendRequestId = useRef<string | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      const stored = await storageGet<LocalChatMessage[]>('session', CHAT_HISTORY_KEY);
      if (!Array.isArray(stored)) {
        return;
      }

      const normalized = stored
        .filter((entry) => entry && typeof entry.id === 'string' && isValidRole(entry.role))
        .map((entry) => ({ id: entry.id, role: entry.role, content: entry.content ?? '' }));

      setMessages(normalized);
    };

    void loadHistory();
  }, []);

  useEffect(() => {
    void storageSet('session', CHAT_HISTORY_KEY, messages);
  }, [messages]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    if (!isStreaming) {
      return;
    }

    const intervalId = setInterval(() => {
      void chrome.runtime.sendMessage({ type: 'KEEP_ALIVE' });
    }, 25_000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isStreaming]);

  const hasMessages = useMemo(() => messages.length > 0, [messages.length]);

  const openAndStream = async (conversationMessages: LocalChatMessage[]) => {
    const requestId = crypto.randomUUID();
    const assistantMessageId = `assistant-${requestId}`;

    const streamBase = [...conversationMessages, { id: assistantMessageId, role: 'assistant' as const, content: '' }];
    setMessages(streamBase);
    setIsStreaming(true);
    setErrorMessage(null);
    setRetryContext({ conversationMessages });

    const payload: ChatStreamStartMessage = {
      type: 'CHAT_STREAM_START',
      requestId,
      modelId,
      messages: buildStreamMessages(conversationMessages, contextSystemMessage),
    };

    const port = chrome.runtime.connect({ name: 'ai-stream' });

    const onMessage = (message: ChatPortResponse) => {
      if (message.requestId !== requestId) {
        return;
      }

      if (message.type === 'CHAT_STREAM_CHUNK') {
        setMessages((previous) =>
          previous.map((entry) =>
            entry.id === assistantMessageId
              ? { ...entry, content: `${entry.content}${message.chunk}` }
              : entry,
          ),
        );
        return;
      }

      if (message.type === 'CHAT_STREAM_ERROR') {
        setIsStreaming(false);
        setErrorMessage(message.message);
        port.onMessage.removeListener(onMessage);
        port.disconnect();
        return;
      }

      if (message.type === 'CHAT_STREAM_DONE') {
        setIsStreaming(false);
        setErrorMessage(null);
        port.onMessage.removeListener(onMessage);
        port.disconnect();
      }
    };

    port.onMessage.addListener(onMessage);
    port.postMessage(payload);
  };

  const handleSend = async (text: string) => {
    if (isStreaming) {
      return;
    }

    const nextConversation = [...messages, { id: `user-${crypto.randomUUID()}`, role: 'user' as const, content: text }];
    await openAndStream(nextConversation);
  };

  useEffect(() => {
    if (!sendRequest || isStreaming) {
      return;
    }

    if (lastHandledSendRequestId.current === sendRequest.id) {
      return;
    }

    lastHandledSendRequestId.current = sendRequest.id;

    void handleSend(sendRequest.text).finally(() => {
      onSendRequestHandled?.(sendRequest.id);
    });
  }, [handleSend, isStreaming, onSendRequestHandled, sendRequest]);

  const retry = async () => {
    if (!retryContext || isStreaming) {
      return;
    }

    await openAndStream(retryContext.conversationMessages);
  };

  const clearChat = () => {
    if (isStreaming) {
      return;
    }

    setMessages([]);
    setRetryContext(null);
    setErrorMessage(null);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Chat window">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs text-slate-600 dark:text-slate-300">Streaming chat</p>
        <button
          type="button"
          onClick={clearChat}
          disabled={isStreaming || !hasMessages}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
          aria-label="Clear chat history"
        >
          Clear chat
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-100 p-3 dark:bg-slate-800">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-slate-500 dark:text-slate-300">Start a conversation in AI mode.</p>
        ) : null}
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isStreaming && messages[messages.length - 1]?.content.length === 0 ? (
          <Skeleton className="h-16 w-2/3" />
        ) : null}
        <div ref={scrollAnchorRef} />
      </div>

      {errorMessage ? (
        <div className="border-t border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <p>{errorMessage}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-2 rounded bg-rose-600 px-2 py-1 text-white hover:bg-rose-700"
            aria-label="Retry failed request"
          >
            Retry
          </button>
        </div>
      ) : null}

      <ChatInput
        isDisabled={isStreaming}
        value={draftText}
        onChange={onDraftTextChange}
        onSend={handleSend}
      />
    </section>
  );
}
