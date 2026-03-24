import { useEffect, useMemo, useRef, useState } from 'react';

import { MessageSquareDashed } from 'lucide-react';

import { CHAT_MODELS, buildPageContextSystemPrompt, detectContentType } from '../../lib/ai';
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

function normalizeStoredMessages(messages: LocalChatMessage[] | undefined): LocalChatMessage[] {
  if (!messages || messages.length === 0) {
    return [];
  }

  return messages.map((message) => ({
    ...message,
    timestamp: typeof message.timestamp === 'number' ? message.timestamp : Date.now(),
  }));
}

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
  onNavigateToSettings: () => void;
};

export function ChatPanel({
  pageContext,
  previousPageContext,
  carryContext,
  sendRequest,
  onSendRequestHandled,
  modelId,
  onModelChange,
  onNavigateToSettings,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [isRereading, setIsRereading] = useState(false);
  const [showPageChangeToast, setShowPageChangeToast] = useState(false);
  const [isPortReady, setIsPortReady] = useState(false);
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const activeTabIdRef = useRef<number | null>(null);
  const streamPortRef = useRef<chrome.runtime.Port | null>(null);
  const lastPageUrlRef = useRef<string | null>(null);
  const streamWatchdogRef = useRef<number | null>(null);

  const quickActions = useMemo(() => {
    if (!pageContext || pageContext.source === 'fallback' || pageContext.source === 'unsupported') {
      return ['What can you help me with?', 'How do I use this extension?'];
    }

    const contentType = detectContentType(pageContext.url, pageContext.content);
    const actionMap: Record<string, string[]> = {
      video: ['Summarize this video', 'What are the key points?', 'Give me timestamps for main topics'],
      code: ['Explain this codebase', 'What does this repo do?', 'Find potential bugs'],
      recipe: ['List the ingredients', 'Can I substitute anything?', 'How long does this take?'],
      product: ['Is this worth buying?', 'What are the main pros and cons?', 'Compare to alternatives'],
      article: ['Summarize in 3 bullets', 'What claims are made?', "What's the author's bias?"],
      docs: ['Give me a quick start', 'Show me a code example', 'What are common gotchas?'],
      page: ['Summarize this page', 'What is this about?', 'Key takeaways'],
    };

    return actionMap[contentType] ?? actionMap.page;
  }, [pageContext]);

  const triggerPageReread = async () => {
    setIsRereading(true);
    const tabId = await getActiveTabId();
    if (!tabId) {
      setIsRereading(false);
      return;
    }

    try {
      await chrome.tabs.sendMessage(tabId, { type: 'REQUEST_PAGE_CONTENT_SNAPSHOT' });
    } catch {
      // Ignore if content script is not reachable.
    } finally {
      setIsRereading(false);
    }
  };

  useEffect(() => {
    const port = chrome.runtime.connect({ name: STREAM_PORT_NAME });
    streamPortRef.current = port;
    setIsPortReady(true);

    const clearWatchdog = () => {
      if (streamWatchdogRef.current) {
        window.clearTimeout(streamWatchdogRef.current);
        streamWatchdogRef.current = null;
      }
    };

    const armWatchdog = () => {
      clearWatchdog();
      streamWatchdogRef.current = window.setTimeout(() => {
        setIsStreaming(false);
        setChatError('Streaming timed out. You can retry or stop and resend.');
        activeRequestIdRef.current = null;
      }, 35_000);
    };

    const onPortMessage = (message: ChatPortResponse) => {
      const requestId = activeRequestIdRef.current;
      if (!requestId || message.requestId !== requestId) {
        return;
      }

      if (message.type === 'CHAT_STREAM_CHUNK') {
        const typed = message as ChatStreamChunkMessage;
        armWatchdog();
        setMessages((previous) => {
          const next = [...previous];
          const last = next[next.length - 1];

          if (!last || last.role !== 'assistant' || last.id !== requestId) {
            next.push({ id: requestId, role: 'assistant', content: typed.chunk, timestamp: Date.now() });
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
          clearWatchdog();
        }
        return;
      }

      if (message.type === 'CHAT_STREAM_ERROR') {
        const typed = message as ChatStreamErrorMessage;
        setChatError(typed.message);
        activeRequestIdRef.current = null;
        setIsStreaming(false);
        clearWatchdog();
      }
    };

    port.onMessage.addListener(onPortMessage);
    port.onDisconnect.addListener(() => {
      setIsPortReady(false);
      clearWatchdog();
      if (activeRequestIdRef.current) {
        setChatError('Stream connection closed. You can retry the message.');
        setIsStreaming(false);
        activeRequestIdRef.current = null;
      }
    });

    return () => {
      clearWatchdog();
      port.onMessage.removeListener(onPortMessage);
      port.disconnect();
      streamPortRef.current = null;
      setIsPortReady(false);
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
      setMessages(normalizeStoredMessages(state?.messages));
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

  const startStream = (conversation: LocalChatMessage[], port: chrome.runtime.Port) => {
    const requestId = crypto.randomUUID();
    setIsStreaming(true);
    setChatError(null);
    activeRequestIdRef.current = requestId;
    if (streamWatchdogRef.current) {
      window.clearTimeout(streamWatchdogRef.current);
    }
    streamWatchdogRef.current = window.setTimeout(() => {
      setIsStreaming(false);
      setChatError('Streaming timed out. You can retry or stop and resend.');
      activeRequestIdRef.current = null;
    }, 35_000);

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

  const sendPrompt = (prompt: string) => {
    const userMessage: LocalChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    };

    const conversation = [...messages, userMessage];
    setMessages(conversation);

    const port = streamPortRef.current;
    if (!port || isStreaming) {
      setQueuedPrompt(prompt);
      return;
    }

    setQueuedPrompt(null);
    startStream(conversation, port);
  };

  const handleSend = (prompt: string) => {
    setLastFailedPrompt(prompt);
    sendPrompt(prompt);
  };

  useEffect(() => {
    if (!queuedPrompt || !isPortReady || isStreaming) {
      return;
    }

    const port = streamPortRef.current;
    if (!port) {
      return;
    }

    setQueuedPrompt(null);
    startStream(messages, port);
  }, [isPortReady, isStreaming, messages, queuedPrompt]);

  const handleStopStream = () => {
    const requestId = activeRequestIdRef.current;

    if (requestId && streamPortRef.current) {
      streamPortRef.current.postMessage({
        type: 'CHAT_STREAM_CANCEL',
        requestId,
      });
    }

    activeRequestIdRef.current = null;
    setIsStreaming(false);
    setChatError(null);
    if (streamWatchdogRef.current) {
      window.clearTimeout(streamWatchdogRef.current);
      streamWatchdogRef.current = null;
    }
  };

  const handleClearConversation = () => {
    setMessages([]);
    setChatError(null);
    setLastFailedPrompt(null);
    setQueuedPrompt(null);
    activeRequestIdRef.current = null;

    if (streamWatchdogRef.current) {
      window.clearTimeout(streamWatchdogRef.current);
      streamWatchdogRef.current = null;
    }

    const tabId = activeTabIdRef.current;
    if (tabId) {
      void chrome.storage.session.remove(createChatStorageKey(tabId));
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      setChatError(null);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

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
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="min-w-0 flex-1 truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {carryContext && previousPageContext
            ? `${pageContext?.title ?? 'current page'} + ${previousPageContext.title}`
            : pageContext?.title ?? 'No page context'}
        </span>

        <div className="flex shrink-0 items-center gap-1">
          {isStreaming ? (
            <button
              type="button"
              className="ui-btn ui-btn-ghost ui-btn-trace !px-2 !py-1 text-[11px]"
              onClick={handleStopStream}
            >
              Stop
            </button>
          ) : null}
          <button
            type="button"
            className="ui-btn ui-btn-ghost !px-2 !py-1 text-[11px]"
            onClick={() => void triggerPageReread()}
            disabled={isRereading}
          >
            {isRereading ? '...' : 'Re-read'}
          </button>
          {messages.length > 0 && !isStreaming ? (
            <button
              type="button"
              className="ui-btn ui-btn-ghost !px-2 !py-1 text-[11px]"
              onClick={handleClearConversation}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {showPageChangeToast ? <div className="ui-page-toast mx-4">✨ New page</div> : null}

      {messages.length === 0 ? (
        <div className="pt-2">
          <div className="mb-5 flex items-center justify-center px-4">
            <div className="ui-empty !min-h-0">
              <MessageSquareDashed size={32} className="ui-muted" />
              <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Hi, how can I help?
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 px-4 pb-3">
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
        <div
          className="mx-3 mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <span style={{ color: '#f59e0b' }}>⚠</span>
          <div className="min-w-0 flex-1">
            <p style={{ color: 'var(--text-secondary)' }}>
              {chatError.includes('timed out')
                ? 'Response timed out.'
                : chatError.includes('Rate limit') || chatError.includes('429')
                  ? 'Rate limit hit. Wait 30s and retry.'
                  : chatError.includes('API key') || chatError.includes('missing')
                    ? 'No API key. Open Settings to add one.'
                    : chatError}
            </p>
            <div className="mt-1.5 flex gap-2">
              {lastFailedPrompt ? (
                <button
                  type="button"
                  onClick={() => sendPrompt(lastFailedPrompt)}
                  className="text-[11px] font-medium"
                  style={{ color: 'var(--accent)' }}
                >
                  Retry →
                </button>
              ) : null}
              {chatError.includes('API key') || chatError.includes('missing') ? (
                <button
                  type="button"
                  onClick={onNavigateToSettings}
                  className="text-[11px] font-medium"
                  style={{ color: 'var(--accent)' }}
                >
                  Settings →
                </button>
              ) : null}
            </div>
          </div>
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
