import { useEffect, useMemo, useRef, useState } from 'react';

import { buildPageContextSystemPrompt } from '../../lib/ai';
import type {
  ChatPortResponse,
  ChatStreamChunkMessage,
  ChatStreamDoneMessage,
  ChatStreamErrorMessage,
  LocalChatMessage,
  SerializableModelMessage,
} from '../../types/chat';
import type { PageContentResult } from '../../types/page';
import { ChatInput } from './ChatInput';
import { ChatWindow } from './ChatWindow';

const CHAT_STORAGE_PREFIX = 'chat:tab:';
const STREAM_PORT_NAME = 'ai-stream';
const MODEL_ID = 'llama-3.3-70b-versatile';

type StoredChatState = {
  messages: LocalChatMessage[];
};

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

function createChatStorageKey(tabId: number): string {
  return `${CHAT_STORAGE_PREFIX}${tabId}`;
}

function toSerializableMessages(
  messages: LocalChatMessage[],
  pageContext: PageContentResult | null,
): SerializableModelMessage[] {
  const conversation: SerializableModelMessage[] = messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  if (!pageContext || !pageContext.content) {
    return conversation;
  }

  return [
    {
      role: 'system',
      content: buildPageContextSystemPrompt(pageContext),
    },
    ...conversation,
  ];
}

type ChatPanelProps = {
  pageContext: PageContentResult | null;
  sendRequest?: { id: string; text: string } | null;
  onSendRequestHandled?: (id: string) => void;
};

export function ChatPanel({ pageContext, sendRequest, onSendRequestHandled }: ChatPanelProps) {
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const activeTabIdRef = useRef<number | null>(null);
  const streamPortRef = useRef<chrome.runtime.Port | null>(null);

  const quickActions = useMemo(
    () => ['Summarize this page', 'What is this about?', 'Key takeaways'],
    [],
  );

  useEffect(() => {
    const port = chrome.runtime.connect({ name: STREAM_PORT_NAME });
    streamPortRef.current = port;

    const onPortMessage = (message: ChatPortResponse) => {
      const requestId = activeRequestIdRef.current;
      if (!requestId || message.requestId !== requestId) {
        return;
      }

      if (message.type === 'CHAT_STREAM_CHUNK') {
        const typed = message as ChatStreamChunkMessage;
        setMessages((previous) => {
          const next = [...previous];
          const last = next[next.length - 1];

          if (!last || last.role !== 'assistant' || last.id !== requestId) {
            next.push({ id: requestId, role: 'assistant', content: typed.chunk });
            return next;
          }

          next[next.length - 1] = {
            ...last,
            content: `${last.content}${typed.chunk}`,
          };
          return next;
        });
        return;
      }

      if (message.type === 'CHAT_STREAM_DONE') {
        const typed = message as ChatStreamDoneMessage;
        if (typed.requestId === requestId) {
          activeRequestIdRef.current = null;
          setIsStreaming(false);
        }
        return;
      }

      if (message.type === 'CHAT_STREAM_ERROR') {
        const typed = message as ChatStreamErrorMessage;
        setChatError(typed.message);
        activeRequestIdRef.current = null;
        setIsStreaming(false);
      }
    };

    port.onMessage.addListener(onPortMessage);

    return () => {
      port.onMessage.removeListener(onPortMessage);
      port.disconnect();
      streamPortRef.current = null;
    };
  }, []);

  useEffect(() => {
    const loadMessages = async () => {
      const tabId = await getActiveTabId();
      activeTabIdRef.current = tabId;

      if (!tabId) {
        setMessages([]);
        return;
      }

      const key = createChatStorageKey(tabId);
      const stored = await chrome.storage.session.get(key);
      const state = stored[key] as StoredChatState | undefined;
      setMessages(state?.messages ?? []);
    };

    const onActivated = () => {
      void loadMessages();
    };

    void loadMessages();
    chrome.tabs.onActivated.addListener(onActivated);

    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
    };
  }, []);

  useEffect(() => {
    const tabId = activeTabIdRef.current;
    if (!tabId) {
      return;
    }

    const key = createChatStorageKey(tabId);
    const state: StoredChatState = { messages };
    void chrome.storage.session.set({ [key]: state });
  }, [messages]);

  useEffect(() => {
    if (!isStreaming) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void chrome.runtime.sendMessage({ type: 'KEEP_ALIVE' });
    }, 25_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isStreaming]);

  const sendPrompt = (prompt: string) => {
    const port = streamPortRef.current;
    if (!port || isStreaming) {
      return;
    }

    const userMessage: LocalChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
    };

    const requestId = crypto.randomUUID();
    const conversation = [...messages, userMessage];

    setMessages(conversation);
    setIsStreaming(true);
    setChatError(null);
    activeRequestIdRef.current = requestId;

    const serializable = toSerializableMessages(conversation, pageContext);

    port.postMessage({
      type: 'CHAT_STREAM_START',
      requestId,
      modelId: MODEL_ID,
      messages: serializable,
    });
  };

  const handleSend = (prompt: string) => {
    setLastFailedPrompt(prompt);
    sendPrompt(prompt);
  };

  useEffect(() => {
    if (!sendRequest) {
      return;
    }

    handleSend(sendRequest.text);
    onSendRequestHandled?.(sendRequest.id);
  }, [onSendRequestHandled, sendRequest]);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-200 px-4 py-2">
        <p className="text-xs text-slate-500">Chatting about: {pageContext?.title ?? 'current page'}</p>
      </div>

      {messages.length === 0 ? (
        <div className="px-4 pt-3">
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => handleSend(action)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-accent hover:text-accent"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {chatError ? (
        <div className="mx-3 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <p>{chatError}</p>
          {lastFailedPrompt ? (
            <button
              type="button"
              onClick={() => sendPrompt(lastFailedPrompt)}
              className="mt-2 rounded-md border border-rose-300 px-2 py-1 text-xs"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      <ChatWindow messages={messages} isStreaming={isStreaming} />
      <ChatInput isSending={isStreaming} onSend={handleSend} />
    </section>
  );
}
