import { registerEmbedRules } from '../src/lib/declarativeRules';
import { streamChat } from '../src/lib/ai';
import type { ChatPortResponse, ChatStreamStartMessage, SerializableModelMessage } from '../src/types/chat';

async function syncEmbedRules(): Promise<void> {
  try {
    await registerEmbedRules();
  } catch (error) {
    console.error('Failed to register embed rules', error);
  }
}

function toModelMessages(messages: SerializableModelMessage[]) {
  return messages.map((message) => {
    if (message.role === 'system') {
      return {
        role: 'system' as const,
        content: message.content,
      };
    }

    if (message.role === 'assistant') {
      return {
        role: 'assistant' as const,
        content: message.content,
      };
    }

    return {
      role: 'user' as const,
      content: message.content,
    };
  });
}

function toErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 429) {
      return 'Rate limit hit. Try again in about a minute.';
    }
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return 'Failed to stream response.';
}

function postSafe(port: chrome.runtime.Port, message: ChatPortResponse): boolean {
  try {
    port.postMessage(message);
    return true;
  } catch {
    return false;
  }
}

async function handleChatStream(port: chrome.runtime.Port, message: ChatStreamStartMessage) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 30_000);

  try {
    const stream = await streamChat({
      messages: toModelMessages(message.messages),
      modelId: message.modelId,
      abortSignal: abortController.signal,
    });

    for await (const chunk of stream.textStream) {
      const didPost = postSafe(port, {
        type: 'CHAT_STREAM_CHUNK',
        requestId: message.requestId,
        chunk,
      });

      if (!didPost) {
        break;
      }
    }

    postSafe(port, {
      type: 'CHAT_STREAM_DONE',
      requestId: message.requestId,
    });
  } catch (error) {
    postSafe(port, {
      type: 'CHAT_STREAM_ERROR',
      requestId: message.requestId,
      message: toErrorMessage(error),
    });
  } finally {
    clearTimeout(timeout);
  }
}

export default defineBackground(() => {
  void syncEmbedRules();

  chrome.runtime.onInstalled.addListener(() => {
    void syncEmbedRules();
  });

  chrome.runtime.onStartup.addListener(() => {
    void syncEmbedRules();
  });

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
    console.error('Failed to enable side panel behavior', error);
  });

  chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.id) {
      return;
    }

    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (error) {
      console.error('Failed to open side panel', error);
    }
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'ai-stream') {
      return;
    }

    port.onMessage.addListener((rawMessage: ChatStreamStartMessage) => {
      if (!rawMessage || rawMessage.type !== 'CHAT_STREAM_START') {
        return;
      }

      void handleChatStream(port, rawMessage);
    });
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== 'KEEP_ALIVE') {
      return;
    }

    return true;
  });
});
