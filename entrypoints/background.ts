import { registerEmbedRules } from '../src/lib/declarativeRules';
import { streamChat } from '../src/lib/ai';
import { DEFAULT_OCR_LANGUAGE, normalizeOcrLanguage, recognizeImageText } from '../src/lib/extractors/ocr';
import { chunkTranscript, fetchTranscriptByVideoId } from '../src/lib/extractors/youtube';
import {
  ACTIVE_PAGE_TAB_ID_KEY,
  buildFallbackPageContext,
  createPageContextStorageKey,
  createPreviousPageContextStorageKey,
  shouldExtractPageFromUrl,
} from '../src/lib/pageContextStore';
import { storageGetSecret } from '../src/lib/storage';
import type {
  ChatPortResponse,
  ChatStreamCancelMessage,
  ChatStreamStartMessage,
  SerializableModelMessage,
} from '../src/types/chat';
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

const PENDING_SELECTION_PROMPT_PREFIX = 'chat:pendingSelectionPrompt:';
const GLOBAL_PENDING_SELECTION_PROMPT_KEY = 'chat:pendingSelectionPrompt';

function createPendingSelectionPromptKey(tabId: number): string {
  return `${PENDING_SELECTION_PROMPT_PREFIX}${tabId}`;
}

function extractPagePayloadInPage(selectionText: string) {
  const maxExtractChars = 20_000;

  const truncate = (value: string, max = maxExtractChars): string => {
    if (value.length <= max) {
      return value;
    }

    return value.slice(0, max);
  };

  const normalize = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim();
  const url = window.location.href;
  const title = normalize(document.title) || 'Untitled page';
  const selection = normalize(selectionText);
  console.log('[pocket-ai] extracting:', title);
  console.log('[pocket-ai] body length:', (document.body?.textContent ?? '').length);

  try {
    console.log('[pocket-ai] extraction step 1 readability begin', { url });
    const ReadabilityCtor = (window as Window & { Readability?: new (doc: Document) => { parse: () => { title?: string | null; textContent?: string | null } | null } }).Readability;

    if (ReadabilityCtor) {
      const clonedDoc = document.cloneNode(true) as Document;
      const reader = new ReadabilityCtor(clonedDoc);
      const article = reader.parse();
      const readableText = normalize(article?.textContent);

      if (article && readableText.length > 200) {
        console.log('[pocket-ai] extraction step 1 readability success', {
          url,
          length: readableText.length,
        });

        const readabilityResult = {
          title: normalize(article.title) || title,
          url,
          content: truncate(readableText),
          source: 'readability' as const,
          selection: selection || undefined,
        };
        console.log('[pocket-ai] result:', readabilityResult.source, readabilityResult.content.length);

        return readabilityResult;
      }

      console.log('[pocket-ai] extraction step 1 readability empty', {
        url,
        length: readableText.length,
      });
    } else {
      console.log('[pocket-ai] extraction step 1 readability unavailable', { url });
    }
  } catch (error) {
    console.log('[pocket-ai] extraction step 1 readability error', { url, error });
  }

  console.log('[pocket-ai] extraction step 2 dom fallback begin', { url });
  const selectors = ['main', 'article', '[role="main"]', '.content', '#content', '.post', '#post'];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = normalize(element?.textContent);

    if (text.length > 200) {
      console.log('[pocket-ai] extraction step 2 dom fallback success', {
        url,
        selector,
        length: text.length,
      });

      const domResult = {
        title,
        url,
        content: truncate(text),
        source: 'dom' as const,
        selection: selection || undefined,
        warning: `Using DOM fallback selector: ${selector}`,
      };
      console.log('[pocket-ai] result:', domResult.source, domResult.content.length);

      return domResult;
    }
  }

  console.log('[pocket-ai] extraction step 3 body fallback begin', { url });
  const bodyText = normalize(document.body?.textContent ?? '');
  const lastResortText = bodyText;
  if (lastResortText.length > 100) {
    console.log('[pocket-ai] extraction step 3 body fallback success', {
      url,
      length: lastResortText.length,
    });

    const bodyResult = {
      title,
      url,
      content: truncate(lastResortText),
      source: 'body' as const,
      selection: selection || undefined,
      warning: 'Using body text fallback extraction.',
    };
    console.log('[pocket-ai] result:', bodyResult.source, bodyResult.content.length);

    return bodyResult;
  }

  console.log('[pocket-ai] extraction step 4 unsupported', { url });
  const unsupportedResult = {
    title,
    url,
    content: '',
    source: 'unsupported' as const,
    selection: selection || undefined,
    warning: 'No extractable content found on this page.',
  };
  console.log('[pocket-ai] result:', unsupportedResult.source, unsupportedResult.content.length);

  return unsupportedResult;
}

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

async function handleChatStream(
  port: chrome.runtime.Port,
  message: ChatStreamStartMessage,
  abortController: AbortController,
) {
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
  console.debug('[pocket-ai] storing page context', {
    tabId,
    url: page.url,
    title: page.title,
    contentLength: page.content.length,
    source: page.source,
  });

  const currentKey = createPageContextStorageKey(tabId);
  const previousKey = createPreviousPageContextStorageKey(tabId);
  const existing = await chrome.storage.session.get([currentKey, previousKey]);
  const currentStored = existing[currentKey] as PageContentMessage['payload'] | undefined;
  const previousStored = existing[previousKey] as PageContentMessage['payload'] | undefined;

  let nextPrevious = previousStored;
  if (currentStored && currentStored.url !== page.url) {
    nextPrevious = currentStored;
  }

  await chrome.storage.session.set({
    [currentKey]: page,
    [previousKey]: nextPrevious,
    [ACTIVE_PAGE_TAB_ID_KEY]: tabId,
  });

  void chrome.runtime.sendMessage({
    type: 'PAGE_CONTENT_UPDATED',
    tabId,
    page,
    previousPage: nextPrevious,
  });
}

async function setActiveContextTab(tabId: number): Promise<void> {
  console.debug('[pocket-ai] set active context tab', { tabId });
  await chrome.storage.session.set({ [ACTIVE_PAGE_TAB_ID_KEY]: tabId });
}

async function requestTabContextRefresh(tabId: number): Promise<void> {
  try {
    console.debug('[pocket-ai] requesting tab context refresh', { tabId });
    await chrome.tabs.sendMessage<RequestPageContentSnapshotMessage, { ok?: boolean }>(tabId, {
      type: 'REQUEST_PAGE_CONTENT_SNAPSHOT',
    });
  } catch {
    // Ignore tabs where content script is unavailable.
  }
}

async function runScreenshotOcrFallback(tabId: number, tab: chrome.tabs.Tab): Promise<PageContentMessage['payload'] | null> {
  if (!tab.windowId) {
    return null;
  }

  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    if (!dataUrl) {
      return null;
    }

    const ocrResponse = await chrome.tabs.sendMessage(tabId, {
      type: 'RUN_SCREENSHOT_OCR',
      imageDataUrl: dataUrl,
    }) as { ok: boolean; text?: string; message?: string };

    const text = typeof ocrResponse?.text === 'string' ? ocrResponse.text.trim() : '';
    if (!ocrResponse?.ok || text.length < 100) {
      console.debug('[pocket-ai] screenshot OCR produced insufficient text', {
        tabId,
        ok: ocrResponse?.ok,
        length: text.length,
        message: ocrResponse?.message,
      });
      return null;
    }

    return {
      title: tab.title || 'Untitled page',
      url: tab.url || '',
      content: text.slice(0, 20_000),
      source: 'ocr',
      warning: 'Note: content extracted via OCR screenshot',
    };
  } catch (error) {
    console.error('[pocket-ai] screenshot OCR fallback failed', { tabId, error });
    return null;
  }
}

async function extractPageContentForTab(tabId: number, selectionText = '', reason = 'unknown'): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  const tabUrl = tab.url ?? '';

  if (!shouldExtractPageFromUrl(tabUrl)) {
    console.debug('[pocket-ai] extraction skipped for unsupported URL protocol', { tabId, tabUrl, reason });
    await storePageContentForTab(tabId, buildFallbackPageContext(tabUrl));
    return;
  }

  console.debug('[pocket-ai] extraction begin via executeScript', {
    tabId,
    tabUrl,
    reason,
    selectionLength: selectionText.length,
  });

  try {
    const injected = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractPagePayloadInPage,
      args: [selectionText],
    });

    const payload = injected[0]?.result as PageContentMessage['payload'] | undefined;
    if (!payload) {
      console.debug('[pocket-ai] extraction produced no payload result', { tabId, reason });
      await storePageContentForTab(tabId, {
        ...buildFallbackPageContext(tabUrl),
        warning: 'Extraction script returned no result.',
      });
      return;
    }

    const safePayload: PageContentMessage['payload'] = {
      title: payload.title || tab.title || 'Untitled page',
      url: payload.url || tabUrl,
      content: payload.content || '',
      source: payload.source,
      warning: payload.warning,
      selection: payload.selection,
      excerpt: payload.excerpt,
    };

    if (!safePayload.content && safePayload.source !== 'unsupported') {
      safePayload.source = 'unsupported';
      safePayload.warning = 'Extraction returned empty content.';
    }

    if (safePayload.content.length < 100) {
      const activeTabId = await getActiveTabId();
      if (activeTabId === tabId) {
        const ocrFallback = await runScreenshotOcrFallback(tabId, tab);
        if (ocrFallback) {
          await storePageContentForTab(tabId, ocrFallback);
          return;
        }
      }
    }

    console.debug('[pocket-ai] extraction complete', {
      tabId,
      reason,
      source: safePayload.source,
      contentLength: safePayload.content.length,
      url: safePayload.url,
    });

    await storePageContentForTab(tabId, safePayload);
  } catch (error) {
    console.error('[pocket-ai] extraction executeScript failed', {
      tabId,
      reason,
      tabUrl,
      error,
    });

    await storePageContentForTab(tabId, {
      title: tab.title || 'Untitled page',
      url: tabUrl,
      content: '',
      source: 'unsupported',
      selection: selectionText || undefined,
      warning: 'Page extraction failed in executeScript.',
    });
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

      console.debug('[pocket-ai] no stored page context yet', { tabId, url });

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
    console.debug('[pocket-ai] tabs.onActivated fired', { tabId: activeInfo.tabId });
    void setActiveContextTab(activeInfo.tabId);

    void chrome.tabs.get(activeInfo.tabId).then((tab) => {
      if (tab.url && !shouldExtractPageFromUrl(tab.url)) {
        void storePageContentForTab(activeInfo.tabId, buildFallbackPageContext(tab.url));
      }
    });

    void requestTabContextRefresh(activeInfo.tabId);
    void extractPageContentForTab(activeInfo.tabId, '', 'tabs.onActivated');
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') {
      return;
    }

    if (tab.active) {
      void setActiveContextTab(tabId);
    }

    if (tab.url && !shouldExtractPageFromUrl(tab.url)) {
      void storePageContentForTab(tabId, buildFallbackPageContext(tab.url));
      return;
    }

    void requestTabContextRefresh(tabId);
    void extractPageContentForTab(tabId, '', 'tabs.onUpdated');
  });

  console.info('[pocket-ai] background listeners ready: tabs.onActivated + tabs.onUpdated');

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

    let activeRequestId: string | null = null;
    let activeAbortController: AbortController | null = null;

    const abortActiveStream = (requestId?: string) => {
      if (!activeAbortController) {
        return;
      }

      if (requestId && activeRequestId && requestId !== activeRequestId) {
        return;
      }

      activeAbortController.abort();
      activeAbortController = null;
      activeRequestId = null;
    };

    port.onDisconnect.addListener(() => {
      abortActiveStream();
    });

    port.onMessage.addListener((rawMessage: ChatStreamStartMessage | ChatStreamCancelMessage) => {
      if (!rawMessage) {
        return;
      }

      if (rawMessage.type === 'CHAT_STREAM_CANCEL') {
        abortActiveStream(rawMessage.requestId);
        return;
      }

      if (rawMessage.type !== 'CHAT_STREAM_START') {
        return;
      }

      abortActiveStream();
      activeRequestId = rawMessage.requestId;
      activeAbortController = new AbortController();

      void handleChatStream(port, rawMessage, activeAbortController).finally(() => {
        if (activeRequestId === rawMessage.requestId) {
          activeRequestId = null;
          activeAbortController = null;
        }
      });
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

    if (message.type === 'REQUEST_BACKGROUND_PAGE_SNAPSHOT') {
      const tabId = _sender.tab?.id;
      if (!tabId) {
        sendResponse({ ok: false, message: 'Missing sender tab ID.' });
        return false;
      }

      const selectionText = typeof message.selection === 'string' ? message.selection : '';
      const reason = typeof message.reason === 'string' ? message.reason : 'content-script-request';

      void extractPageContentForTab(tabId, selectionText, reason).then(() => {
        sendResponse({ ok: true });
      });

      return true;
    }

    if (
      message.type === 'SELECTION_ACTION' &&
      typeof message.action === 'string' &&
      typeof message.text === 'string'
    ) {
      const tabId = _sender.tab?.id;
      if (!tabId) {
        sendResponse({ ok: false });
        return false;
      }

      void chrome.storage.session
        .set({
          [createPendingSelectionPromptKey(tabId)]: { action: message.action, text: message.text },
          [GLOBAL_PENDING_SELECTION_PROMPT_KEY]: { action: message.action, text: message.text },
        })
        .then(() => chrome.sidePanel.open({ tabId }))
        .then(() => {
        openSidePanelTabs.add(tabId);
        void chrome.runtime.sendMessage({ type: 'SELECTION_ACTION', action: message.action, text: message.text });
        sendResponse({ ok: true });
        })
        .catch(() => {
          sendResponse({ ok: false });
        });

      return true;
    }

    return;
  });
});
