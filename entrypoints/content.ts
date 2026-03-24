import { Readability } from '@mozilla/readability';
import {
  FEATURE_TOGGLES_STORAGE_KEY,
  PRIVATE_MODE_STORAGE_KEY,
  getEffectiveFeatureToggles,
  normalizeFeatureToggles,
  type FeatureToggles,
} from '../src/lib/featureToggles';
import { recognizeImageText } from '../src/lib/extractors/ocr';
import type {
  GetPageContentMessage,
  GetPageContentResponse,
  RequestPageContentSnapshotMessage,
} from '../src/types/page';
import type { GetYouTubeVideoInfoMessage, GetYouTubeVideoInfoResponse } from '../src/types/youtube';
import type { GetPageImagesMessage, GetPageImagesResponse } from '../src/types/ocr';

declare global {
  interface Window {
    Readability?: typeof Readability;
  }
}

function extractYouTubeVideoIdFromUrl(url: string): string | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  const host = parsedUrl.hostname.replace(/^www\./, '');

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (parsedUrl.pathname === '/watch') {
      return parsedUrl.searchParams.get('v');
    }

    if (parsedUrl.pathname.startsWith('/shorts/')) {
      const parts = parsedUrl.pathname.split('/').filter(Boolean);
      return parts[1] ?? null;
    }
  }

  if (host === 'youtu.be') {
    const parts = parsedUrl.pathname.split('/').filter(Boolean);
    return parts[0] ?? null;
  }

  return null;
}

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    window.Readability = Readability;
    console.log('[pocket-ai] content script loaded on:', window.location.href);

    let latestSelection = '';
    let selectionToolbar: HTMLDivElement | null = null;
    let lastObservedScrollHeight = document.documentElement.scrollHeight;
    let suppressToolbarUntil = 0;
    let effectiveToggles = getEffectiveFeatureToggles(undefined, false);

    const loadEffectiveToggles = async () => {
      const stored = await chrome.storage.local.get([
        FEATURE_TOGGLES_STORAGE_KEY,
        PRIVATE_MODE_STORAGE_KEY,
      ]);
      const toggles = normalizeFeatureToggles(stored[FEATURE_TOGGLES_STORAGE_KEY] as Partial<FeatureToggles> | undefined);
      effectiveToggles = getEffectiveFeatureToggles(toggles, Boolean(stored[PRIVATE_MODE_STORAGE_KEY]));
    };

    const removeToolbar = () => {
      if (!selectionToolbar) {
        return;
      }

      selectionToolbar.remove();
      selectionToolbar = null;
    };

    const createActionPrompt = (action: 'Explain' | 'Summarize' | 'Translate' | 'Improve', text: string): string =>
      `${action} this: ${text}`;

    const sendSelectionAction = (
      action: 'Explain' | 'Summarize' | 'Translate' | 'Improve',
      text: string,
      attempt = 0,
    ) => {
      chrome.runtime.sendMessage({ type: 'SELECTION_ACTION', action, text }, (response) => {
        if (response?.ok) {
          return;
        }

        if (chrome.runtime.lastError || !response?.ok) {
          if (attempt >= 2) {
            console.warn('[pocket-ai] toolbar send failed after retries', {
              action,
              reason: chrome.runtime.lastError?.message ?? response?.message,
            });
            return;
          }

          window.setTimeout(() => {
            sendSelectionAction(action, text, attempt + 1);
          }, 200 * (attempt + 1));
        }
      });
    };

    const debounce = <T extends (...args: never[]) => void>(fn: T, waitMs: number) => {
      let timeoutId: number | null = null;

      return (...args: Parameters<T>) => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }

        timeoutId = window.setTimeout(() => {
          fn(...args);
        }, waitMs);
      };
    };

    const showToolbar = (rect: DOMRect, text: string) => {
      removeToolbar();

      const toolbar = document.createElement('div');
      toolbar.className = 'pocket-ai-selection-toolbar';
      toolbar.style.position = 'fixed';
      toolbar.style.left = `${rect.left + rect.width / 2}px`;
      toolbar.style.top = `${Math.max(8, rect.top - 44)}px`;
      toolbar.style.transform = 'translate(-50%, 4px)';
      toolbar.style.opacity = '0';
      toolbar.style.background = '#1a1a1a';
      toolbar.style.border = '1px solid rgba(255,255,255,0.12)';
      toolbar.style.borderRadius = '8px';
      toolbar.style.padding = '4px';
      toolbar.style.display = 'flex';
      toolbar.style.gap = '2px';
      toolbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)';
      toolbar.style.zIndex = '2147483647';
      toolbar.style.transition = 'opacity 150ms ease, transform 150ms ease';

      const actions: Array<'Explain' | 'Summarize' | 'Translate' | 'Improve'> = [
        'Explain',
        'Summarize',
        'Translate',
        'Improve',
      ];

      for (const action of actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = action;
        button.style.color = '#ffffff';
        button.style.fontSize = '12px';
        button.style.padding = '4px 8px';
        button.style.borderRadius = '6px';
        button.style.border = 'none';
        button.style.background = 'transparent';
        button.style.cursor = 'pointer';
        button.style.transition = 'background 100ms';

        button.addEventListener('mouseenter', () => {
          button.style.background = 'rgba(139, 92, 246, 0.2)';
          button.style.color = '#c4b5fd';
        });

        button.addEventListener('mouseleave', () => {
          button.style.background = 'transparent';
          button.style.color = '#ffffff';
        });

        const triggerSelectionAction = (event: Event) => {
          event.preventDefault();
          event.stopPropagation();
          const prompt = createActionPrompt(action, text);
          console.log('[pocket-ai] toolbar click:', action, text.slice(0, 60));
          sendSelectionAction(action, text);
          suppressToolbarUntil = Date.now() + 1000;
          removeToolbar();
        };

        button.addEventListener('mousedown', triggerSelectionAction);
        button.addEventListener('click', triggerSelectionAction);

        toolbar.appendChild(button);
      }

      const hint = document.createElement('span');
      hint.textContent = 'esc';
      hint.style.fontSize = '10px';
      hint.style.padding = '4px 6px';
      hint.style.color = 'rgba(255,255,255,0.65)';
      hint.style.alignSelf = 'center';
      hint.style.userSelect = 'none';
      toolbar.appendChild(hint);

      document.documentElement.appendChild(toolbar);
      selectionToolbar = toolbar;

      window.requestAnimationFrame(() => {
        toolbar.style.opacity = '1';
        toolbar.style.transform = 'translate(-50%, 0)';
      });
    };

    const requestBackgroundSnapshot = (reason: string) => {
      const isManual = reason === 'manual-request';
      if (!effectiveToggles.pageContextAutoRead && !isManual) {
        return;
      }

      console.log('[pocket-ai] extracting:', document.title);
      console.log('[pocket-ai] body length:', document.body?.textContent?.length ?? 0);

      void chrome.runtime.sendMessage({
        type: 'REQUEST_BACKGROUND_PAGE_SNAPSHOT',
        reason,
        selection: latestSelection,
      });

      console.debug('[pocket-ai] requested background snapshot', {
        reason,
        url: window.location.href,
        selectionLength: latestSelection.length,
      });
    };

    const checkLazyLoadedGrowth = debounce(() => {
      const currentScrollHeight = document.documentElement.scrollHeight;
      if (currentScrollHeight > lastObservedScrollHeight + 200) {
        lastObservedScrollHeight = currentScrollHeight;
        requestBackgroundSnapshot('scroll-growth');
      }
    }, 700);

    const scheduleAfterInitialExtraction = () => {
      const initialHeight = document.documentElement.scrollHeight;
      window.setTimeout(() => {
        const nextHeight = document.documentElement.scrollHeight;
        if (nextHeight > initialHeight + 200) {
          lastObservedScrollHeight = nextHeight;
          requestBackgroundSnapshot('post-initial-growth');
        }
      }, 1500);
    };

    const observeDynamicDomUpdates = () => {
      const debouncedMutationExtraction = debounce((mutations: MutationRecord[]) => {
        let addedNodes = 0;
        for (const mutation of mutations) {
          addedNodes += mutation.addedNodes.length;
        }

        if (addedNodes >= 10) {
          requestBackgroundSnapshot('mutation-observer');
        }
      }, 1000);

      const observer = new MutationObserver((mutations) => {
        debouncedMutationExtraction(mutations);
      });

      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    };

    const updateSelection = () => {
      if (!effectiveToggles.selectionToolbar) {
        removeToolbar();
        return;
      }

      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? '';
      latestSelection = text;

      if (Date.now() < suppressToolbarUntil) {
        removeToolbar();
        return;
      }

      if (!text || text.length < 10 || !selection || selection.rangeCount === 0) {
        removeToolbar();
        return;
      }

      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) {
          removeToolbar();
          return;
        }

        showToolbar(rect, text);
      } catch {
        removeToolbar();
      }
    };

    document.addEventListener('selectionchange', updateSelection);
    window.addEventListener('mouseup', updateSelection);
    window.addEventListener('keyup', updateSelection);
    window.addEventListener('scroll', removeToolbar, true);
    window.addEventListener('scroll', checkLazyLoadedGrowth, true);
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        removeToolbar();
      }
    });
    document.addEventListener('mousedown', (event) => {
      const target = event.target as Node | null;
      if (selectionToolbar && target && selectionToolbar.contains(target)) {
        return;
      }

      removeToolbar();
    });

    const originalPushState = history.pushState.bind(history);
    history.pushState = ((...args: Parameters<History['pushState']>) => {
      originalPushState(...args);
      requestBackgroundSnapshot('pushstate');
    }) as History['pushState'];

    const originalReplaceState = history.replaceState.bind(history);
    history.replaceState = ((...args: Parameters<History['replaceState']>) => {
      originalReplaceState(...args);
      requestBackgroundSnapshot('replacestate');
    }) as History['replaceState'];

    window.addEventListener('popstate', () => requestBackgroundSnapshot('popstate'));
    window.addEventListener('hashchange', () => requestBackgroundSnapshot('hashchange'));
    window.addEventListener('load', () => requestBackgroundSnapshot('load'));
    window.addEventListener('DOMContentLoaded', () => requestBackgroundSnapshot('domcontentloaded'));

    window.setTimeout(() => requestBackgroundSnapshot('initial-timeout'), 0);
    scheduleAfterInitialExtraction();
    observeDynamicDomUpdates();
    void loadEffectiveToggles();

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') {
        return;
      }

      if (!changes[FEATURE_TOGGLES_STORAGE_KEY] && !changes[PRIVATE_MODE_STORAGE_KEY]) {
        return;
      }

      void loadEffectiveToggles().then(() => {
        if (!effectiveToggles.selectionToolbar) {
          removeToolbar();
        }
      });
    });

    chrome.runtime.onMessage.addListener(
      (
        rawMessage:
          | GetPageContentMessage
          | GetYouTubeVideoInfoMessage
          | RequestPageContentSnapshotMessage
          | GetPageImagesMessage
          | { type: 'RUN_SCREENSHOT_OCR'; imageDataUrl?: string },
        _sender,
        sendResponse,
      ) => {
        if (!rawMessage) {
          return;
        }

        if (rawMessage.type === 'GET_YOUTUBE_VIDEO_INFO') {
          if (!effectiveToggles.youtubeAutoFetch) {
            const response: GetYouTubeVideoInfoResponse = {
              isYouTubePage: false,
              videoId: null,
              url: window.location.href,
              title: document.title,
            };
            sendResponse(response);
            return false;
          }

          const response: GetYouTubeVideoInfoResponse = {
            isYouTubePage: window.location.hostname.includes('youtube.com') ||
              window.location.hostname.includes('youtu.be'),
            videoId: extractYouTubeVideoIdFromUrl(window.location.href),
            url: window.location.href,
            title: document.title,
          };
          sendResponse(response);
          return false;
        }

        if (rawMessage.type === 'REQUEST_PAGE_CONTENT_SNAPSHOT') {
          requestBackgroundSnapshot('manual-request');
          sendResponse({ ok: true });
          return false;
        }

        if (rawMessage.type === 'GET_PAGE_IMAGES') {
          const images = Array.from(document.querySelectorAll('img'))
            .map((img) => img.currentSrc || img.src)
            .filter((value): value is string => Boolean(value));

          const uniqueImages = Array.from(new Set(images)).slice(0, 50);
          const response: GetPageImagesResponse = { ok: true, images: uniqueImages };
          sendResponse(response);
          return false;
        }

        if (rawMessage.type === 'RUN_SCREENSHOT_OCR') {
          const imageDataUrl = typeof rawMessage.imageDataUrl === 'string' ? rawMessage.imageDataUrl : '';
          if (!imageDataUrl) {
            sendResponse({ ok: false, message: 'Missing screenshot payload.' });
            return false;
          }

          void recognizeImageText(imageDataUrl)
            .then((text) => sendResponse({ ok: true, text }))
            .catch((error) =>
              sendResponse({
                ok: false,
                message: error instanceof Error ? error.message : 'Screenshot OCR failed.',
              })
            );

          return true;
        }

        if (rawMessage.type !== 'GET_PAGE_CONTENT') {
          return;
        }

        try {
          const response: GetPageContentResponse = {
            ok: false,
            message: 'Page extraction is handled by background scripting execution.',
          };
          sendResponse(response);
        } catch (error) {
          const response: GetPageContentResponse = {
            ok: false,
            message: error instanceof Error ? error.message : 'Failed to read page content.',
          };
          sendResponse(response);
        }

        return false;
      },
    );
  },
});
