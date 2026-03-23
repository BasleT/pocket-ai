import { registerEmbedRules } from '../src/lib/declarativeRules';
import { streamChat } from '../src/lib/ai';
import { DEFAULT_OCR_LANGUAGE, normalizeOcrLanguage, recognizeImageText } from '../src/lib/extractors/ocr';
import { chunkTranscript, fetchTranscriptByVideoId } from '../src/lib/extractors/youtube';
import {
  ACTIVE_PAGE_TAB_ID_KEY,
  buildFallbackPageContext,
  createPageContextStorageKey,
  shouldExtractPageFromUrl,
} from '../src/lib/pageContextStore';
import { storageGetSecret } from '../src/lib/storage';
import type { ChatPortResponse, ChatStreamStartMessage, SerializableModelMessage } from '../src/types/chat';
import type { GetPageImagesResponse, OcrResult } from '../src/types/ocr';
import type {
  GetPageContentMessage,
  GetPageContentResponse,
  PageContentMessage,
  RequestPageContentSnapshotMessage,
} from '../src/types/page';
import type { ApiProviderId, TestConnectionResponse } from '../src/types/settings';
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
import { API_KEY_FIELD_MAP } from '../src/types/settings';

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

async function storePageContentForTab(tabId: number, page: PageContentMessage['payload']): Promise<void> {
  await chrome.storage.session.set({
    [createPageContextStorageKey(tabId)]: page,
    [ACTIVE_PAGE_TAB_ID_KEY]: tabId,
  });

  void chrome.runtime.sendMessage({
    type: 'PAGE_CONTENT_UPDATED',
    tabId,
    page,
  });
}

async function setActiveContextTab(tabId: number): Promise<void> {
  await chrome.storage.session.set({ [ACTIVE_PAGE_TAB_ID_KEY]: tabId });
}

async function requestTabContextRefresh(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage<RequestPageContentSnapshotMessage, { ok?: boolean }>(tabId, {
      type: 'REQUEST_PAGE_CONTENT_SNAPSHOT',
    });
  } catch {
    // Ignore tabs where content script is unavailable.
  }
}

async function handleGetPageContentRequest(): Promise<GetPageContentResponse> {
  const tabId = await getActiveTabId();
  if (!tabId) {
    return {
      ok: true,
      page: buildFallbackPageContext(''),
    };
  }

  try {
    const key = createPageContextStorageKey(tabId);
    const stored = await chrome.storage.session.get(key);
    const page = stored[key] as PageContentMessage['payload'] | undefined;

    if (!page) {
      const tab = await chrome.tabs.get(tabId);
      const url = tab.url ?? '';

      if (!shouldExtractPageFromUrl(url)) {
        return {
          ok: true,
          page: buildFallbackPageContext(url),
        };
      }

      return {
        ok: false,
        message: 'Page context is still loading. Refresh the page if needed.',
      };
    }

    return { ok: true, page };
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

async function handleGetPageImagesRequest(): Promise<GetPageImagesResponse> {
  const tabId = await getActiveTabId();
  if (!tabId) {
    return { ok: false, images: [] };
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'GET_PAGE_IMAGES',
    });

    if (!response || !Array.isArray(response.images)) {
      return { ok: false, images: [] };
    }

    return { ok: true, images: response.images as string[] };
  } catch {
    return { ok: false, images: [] };
  }
}

async function pingProviderConnection(provider: ApiProviderId, key: string): Promise<TestConnectionResponse> {
  try {
    let response: Response;

    if (provider === 'openai') {
      response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
    } else if (provider === 'anthropic') {
      response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
      });
    } else if (provider === 'google') {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    } else {
      response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
    }

    if (!response.ok) {
      return { ok: false, message: `HTTP ${response.status}` };
    }

    return { ok: true, message: 'Connection successful' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

async function handleTestProviderConnection(provider: ApiProviderId): Promise<TestConnectionResponse> {
  const field = API_KEY_FIELD_MAP[provider];
  const key = await storageGetSecret(field);
  if (!key) {
    return { ok: false, message: 'API key not configured' };
  }

  return pingProviderConnection(provider, key);
}

export default defineBackground(() => {
  const openSidePanelTabs = new Set<number>();

  const toggleSidePanelForTab = async (tabId: number) => {
    if (openSidePanelTabs.has(tabId)) {
      await chrome.sidePanel.close({ tabId });
      openSidePanelTabs.delete(tabId);
      return;
    }

    await chrome.sidePanel.open({ tabId });
    openSidePanelTabs.add(tabId);
  };

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
      openSidePanelTabs.add(tab.id);
    } catch (error) {
      console.error('Failed to open side panel', error);
    }
  });

  chrome.tabs.onActivated.addListener((activeInfo) => {
    void setActiveContextTab(activeInfo.tabId);
    void requestTabContextRefresh(activeInfo.tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') {
      return;
    }

    if (tab.active) {
      void setActiveContextTab(tabId);
    }

    void requestTabContextRefresh(tabId);
  });

  chrome.commands.onCommand.addListener((command, tab) => {
    if (command !== 'toggle-sidepanel' || !tab?.id) {
      return;
    }

    void toggleSidePanelForTab(tab.id).catch((error) => {
      console.error('Failed to toggle side panel from shortcut', error);
    });
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

    if (message.type === 'PAGE_CONTENT') {
      const tabId = _sender.tab?.id;
      if (!tabId || !message.payload) {
        sendResponse({ ok: false });
        return false;
      }

      void storePageContentForTab(tabId, message.payload).then(() => sendResponse({ ok: true }));
      return true;
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

    if (message.type === 'TEST_PROVIDER_CONNECTION') {
      void handleTestProviderConnection(message.provider as ApiProviderId).then((response) =>
        sendResponse(response),
      );
      return true;
    }

    if (message.type === 'GET_PAGE_IMAGES') {
      void handleGetPageImagesRequest().then((response) => sendResponse(response));
      return true;
    }

    if (message.type === 'RUN_OCR_ON_IMAGE' && typeof message.imageUrl === 'string') {
      void handleImageOcrClick(message.imageUrl).then(() => sendResponse({ ok: true }));
      return true;
    }

    return;
  });
});
