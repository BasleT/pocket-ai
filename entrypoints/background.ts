import { registerEmbedRules } from '../src/lib/declarativeRules';
import { streamChat } from '../src/lib/ai';
import { DEFAULT_OCR_LANGUAGE, normalizeOcrLanguage, recognizeImageText } from '../src/lib/extractors/ocr';
import { chunkTranscript, fetchTranscriptByVideoId } from '../src/lib/extractors/youtube';
import type { ChatPortResponse, ChatStreamStartMessage, SerializableModelMessage } from '../src/types/chat';
import type { OcrResult } from '../src/types/ocr';
import type { GetPageContentMessage, GetPageContentResponse } from '../src/types/page';
import type {
  GetYouTubeContextResponse,
  GetYouTubeVideoInfoMessage,
  GetYouTubeVideoInfoResponse,
} from '../src/types/youtube';
import {
  OCR_CONTEXT_MENU_ID,
  OCR_LANGUAGE_STORAGE_KEY,
  OCR_RESULT_STORAGE_KEY,
} from '../src/types/ocr';

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

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function handleGetPageContentRequest(): Promise<GetPageContentResponse> {
  const tabId = await getActiveTabId();
  if (!tabId) {
    return { ok: false, message: 'No active tab found.' };
  }

  try {
    const response = await chrome.tabs.sendMessage<GetPageContentMessage, GetPageContentResponse>(tabId, {
      type: 'GET_PAGE_CONTENT',
    });

    if (!response) {
      return {
        ok: false,
        message: 'No response from content script. Try refreshing the page.',
      };
    }

    return response;
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'Unable to read page content from the active tab.',
    };
  }
}

async function handleGetYouTubeContextRequest(): Promise<GetYouTubeContextResponse> {
  const tabId = await getActiveTabId();
  if (!tabId) {
    return { ok: false, message: 'No active tab found.' };
  }

  let videoInfo: GetYouTubeVideoInfoResponse;

  try {
    const response = await chrome.tabs.sendMessage<
      GetYouTubeVideoInfoMessage,
      GetYouTubeVideoInfoResponse
    >(tabId, {
      type: 'GET_YOUTUBE_VIDEO_INFO',
    });

    if (!response) {
      return { ok: false, message: 'No response from content script.' };
    }

    videoInfo = response;
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : 'Unable to detect YouTube video context.',
    };
  }

  if (!videoInfo.isYouTubePage) {
    return {
      ok: true,
      data: {
        isYouTubePage: false,
        hasTranscript: false,
        title: videoInfo.title,
        url: videoInfo.url,
        videoId: null,
        transcriptChunks: [],
      },
    };
  }

  if (!videoInfo.videoId) {
    return {
      ok: true,
      data: {
        isYouTubePage: true,
        hasTranscript: false,
        title: videoInfo.title,
        url: videoInfo.url,
        videoId: null,
        transcriptChunks: [],
      },
    };
  }

  try {
    const transcriptText = await fetchTranscriptByVideoId(videoInfo.videoId);
    const transcriptChunks = chunkTranscript(transcriptText);

    return {
      ok: true,
      data: {
        isYouTubePage: true,
        hasTranscript: transcriptChunks.length > 0,
        title: videoInfo.title,
        url: videoInfo.url,
        videoId: videoInfo.videoId,
        transcriptChunks,
      },
    };
  } catch {
    return {
      ok: true,
      data: {
        isYouTubePage: true,
        hasTranscript: false,
        title: videoInfo.title,
        url: videoInfo.url,
        videoId: videoInfo.videoId,
        transcriptChunks: [],
      },
    };
  }
}

async function ensureOcrContextMenu(): Promise<void> {
  try {
    await chrome.contextMenus.remove(OCR_CONTEXT_MENU_ID);
  } catch {
    // Ignore if it doesn't exist yet.
  }

  await chrome.contextMenus.create({
    id: OCR_CONTEXT_MENU_ID,
    title: 'Extract text from image',
    contexts: ['image'],
  });
}

async function getSelectedOcrLanguage(): Promise<ReturnType<typeof normalizeOcrLanguage>> {
  const stored = await chrome.storage.local.get(OCR_LANGUAGE_STORAGE_KEY);
  return normalizeOcrLanguage(stored[OCR_LANGUAGE_STORAGE_KEY] as string | undefined);
}

async function persistOcrResult(result: OcrResult): Promise<void> {
  await chrome.storage.session.set({ [OCR_RESULT_STORAGE_KEY]: result });
  void chrome.runtime.sendMessage({ type: 'OCR_RESULT_UPDATED', result });
}

async function handleImageOcrClick(imageUrl: string): Promise<void> {
  const selectedLanguage = await getSelectedOcrLanguage();

  try {
    const text = await recognizeImageText(imageUrl, selectedLanguage);
    await persistOcrResult({
      text,
      language: selectedLanguage,
      imageUrl,
      capturedAt: Date.now(),
    });
  } catch (error) {
    await persistOcrResult({
      text: '',
      language: selectedLanguage,
      imageUrl,
      capturedAt: Date.now(),
      error: error instanceof Error ? error.message : 'OCR extraction failed.',
    });
  }
}

export default defineBackground(() => {
  void syncEmbedRules();
  void ensureOcrContextMenu();

  chrome.runtime.onInstalled.addListener(() => {
    void syncEmbedRules();
    void ensureOcrContextMenu();
    void chrome.storage.local.get(OCR_LANGUAGE_STORAGE_KEY).then((stored) => {
      if (!stored[OCR_LANGUAGE_STORAGE_KEY]) {
        return chrome.storage.local.set({ [OCR_LANGUAGE_STORAGE_KEY]: DEFAULT_OCR_LANGUAGE });
      }

      return undefined;
    });
  });

  chrome.runtime.onStartup.addListener(() => {
    void syncEmbedRules();
    void ensureOcrContextMenu();
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

  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId !== OCR_CONTEXT_MENU_ID || typeof info.srcUrl !== 'string') {
      return;
    }

    void handleImageOcrClick(info.srcUrl);
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message) {
      return;
    }

    if (message.type === 'KEEP_ALIVE') {
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === 'GET_PAGE_CONTENT') {
      void handleGetPageContentRequest().then((response) => sendResponse(response));
      return true;
    }

    if (message.type === 'GET_YOUTUBE_CONTEXT') {
      void handleGetYouTubeContextRequest().then((response) => sendResponse(response));
      return true;
    }

    return;
  });
});
