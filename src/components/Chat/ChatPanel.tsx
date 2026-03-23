import { useEffect, useMemo, useRef, useState } from 'react';

import { MessageSquareDashed } from 'lucide-react';

import { buildPageContextSystemPrompt } from '../../lib/ai';
import { CHAT_MODELS } from '../../lib/ai';
import type {
  ChatModelId,
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
  previousPageContext: PageContentResult | null;
  carryContext: boolean;
  sendRequest?: { id: string; text: string } | null;
  onSendRequestHandled?: (id: string) => void;
  modelId: ChatModelId;
  onModelChange: (modelId: ChatModelId) => void;
};

export function ChatPanel({
  pageContext,
  previousPageContext,
  carryContext,
  sendRequest,
  onSendRequestHandled,
  modelId,
  onModelChange,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [showPageChangeToast, setShowPageChangeToast] = useState(false);
  const activeRequestIdRef = useRef<string | null>(null);
  const activeTabIdRef = useRef<number | null>(null);
  const streamPortRef = useRef<chrome.runtime.Port | null>(null);
  const lastPageUrlRef = useRef<string | null>(null);

  const quickActions = useMemo(
    () => ['Summarize this page', 'What is this about?', 'Key takeaways'],
    [],
  );

  const triggerPageReread = async () => {
    const tabId = await getActiveTabId();
    if (!tabId) {
      return;
    }

    try {
      await chrome.tabs.sendMessage(tabId, { type: 'REQUEST_PAGE_CONTENT_SNAPSHOT' });
    } catch {
      // Ignore if content script is not reachable.
    }
  };

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

    const serializable =
      pageContext && pageContext.content
        ? [
            {
              role: 'system' as const,
              content: buildPageContextSystemPrompt(pageContext, {
                includePreviousContext: carryContext,
                previousPage: previousPageContext,
              }),
            },
            ...conversation.map((entry) => ({ role: entry.role, content: entry.content })),
          ]
        : toSerializableMessages(conversation, pageContext);

    port.postMessage({
      type: 'CHAT_STREAM_START',
      requestId,
      modelId,
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

  useEffect(() => {
    if (!pageContext?.url) {
      return;
    }

    if (!lastPageUrlRef.current) {
      lastPageUrlRef.current = pageContext.url;
      return;
    }

    if (lastPageUrlRef.current === pageContext.url) {
      return;
    }

    lastPageUrlRef.current = pageContext.url;
    setShowPageChangeToast(true);

    const timeoutId = window.setTimeout(() => {
      setShowPageChangeToast(false);
    }, 1500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pageContext?.url]);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 py-3 flex items-center gap-2">
        <p className="ui-subtle text-xs">
          {carryContext && previousPageContext
            ? `🗒️ ${pageContext?.title ?? 'current page'} + ${previousPageContext.title}`
            : `Chatting about: ${pageContext?.title ?? 'current page'}`}
        </p>
        {carryContext && previousPageContext ? (
          <span className="ui-context-pill" title="Including previous tab context">
            📎 Carrying context from: {previousPageContext.title}
          </span>
        ) : null}
        <button type="button" className="ui-btn ui-btn-ghost ml-auto !py-1" onClick={() => void triggerPageReread()}>
          Re-read page
        </button>
      </div>

      {showPageChangeToast ? <div className="ui-page-toast mx-4">✨ New page</div> : null}

      {messages.length === 0 ? (
        <div className="px-4 pt-2">
          <div className="mb-5 flex items-center justify-center">
            <div className="ui-empty !min-h-0">
              <MessageSquareDashed size={32} className="ui-muted" />
              <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Hi, how can I help?
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => handleSend(action)}
                className="ui-quick-chip"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {chatError ? (
        <div className="ui-overlay mx-3 mt-3 text-xs" style={{ color: 'var(--text-primary)' }}>
          <p>{chatError}</p>
          {lastFailedPrompt ? (
            <button
              type="button"
              onClick={() => sendPrompt(lastFailedPrompt)}
              className="ui-btn ui-btn-ghost mt-2"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      <ChatWindow messages={messages} isStreaming={isStreaming} />
      <ChatInput
        isSending={isStreaming}
        onSend={handleSend}
        modelId={modelId}
        models={CHAT_MODELS}
        onModelChange={onModelChange}
      />
    </section>
  );
}
