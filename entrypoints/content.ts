import { Readability } from '@mozilla/readability';
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

    const removeToolbar = () => {
      if (!selectionToolbar) {
        return;
      }

      selectionToolbar.remove();
      selectionToolbar = null;
    };

    const createActionPrompt = (action: 'Explain' | 'Summarize' | 'Translate' | 'Improve', text: string): string =>
      `${action} this: ${text}`;

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
          button.style.background = 'rgba(255,255,255,0.1)';
        });

        button.addEventListener('mouseleave', () => {
          button.style.background = 'transparent';
        });

        button.addEventListener('click', () => {
          const prompt = createActionPrompt(action, text);
          void chrome.runtime.sendMessage({ type: 'SELECTION_TOOLBAR_ACTION', prompt });
          removeToolbar();
        });

        toolbar.appendChild(button);
      }

      document.documentElement.appendChild(toolbar);
      selectionToolbar = toolbar;

      window.requestAnimationFrame(() => {
        toolbar.style.opacity = '1';
        toolbar.style.transform = 'translate(-50%, 0)';
      });
    };

    const requestBackgroundSnapshot = (reason: string) => {
      console.log('[pocket-ai] extracting:', document.title);
      console.log('[pocket-ai] body length:', document.body?.innerText.length ?? 0);

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

    const updateSelection = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? '';
      latestSelection = text;

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

    chrome.runtime.onMessage.addListener(
      (
        rawMessage:
          | GetPageContentMessage
          | GetYouTubeVideoInfoMessage
          | RequestPageContentSnapshotMessage
          | GetPageImagesMessage,
        _sender,
        sendResponse,
      ) => {
        if (!rawMessage) {
          return;
        }

        if (rawMessage.type === 'GET_YOUTUBE_VIDEO_INFO') {
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
