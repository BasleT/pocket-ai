import { extractPageContentFromDocument } from '../src/lib/extractors/page';
import type {
  GetPageContentMessage,
  GetPageContentResponse,
  PageContentMessage,
  RequestPageContentSnapshotMessage,
} from '../src/types/page';
import type { GetYouTubeVideoInfoMessage, GetYouTubeVideoInfoResponse } from '../src/types/youtube';
import type { GetPageImagesMessage, GetPageImagesResponse } from '../src/types/ocr';
import { shouldExtractPageFromUrl } from '../src/lib/pageContextStore';

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
    console.log('[pocket-ai] content script loaded on:', window.location.href);

    let latestSelection = '';
    let lastDispatchedSignature = '';

    const dispatchPageSnapshot = (reason: string) => {
      const currentUrl = window.location.href;

      if (!shouldExtractPageFromUrl(currentUrl)) {
        console.debug('[pocket-ai] skipping extraction for unsupported URL:', currentUrl);
        return;
      }

      try {
        const page = extractPageContentFromDocument(latestSelection);
        const signature = `${currentUrl}|${page.title}|${page.content.length}|${page.source}`;

        if (signature === lastDispatchedSignature && reason !== 'manual-request') {
          return;
        }

        const message: PageContentMessage = {
          type: 'PAGE_CONTENT',
          payload: page,
        };

        void chrome.runtime.sendMessage(message);
        lastDispatchedSignature = signature;

        console.debug('[pocket-ai] dispatched page snapshot', {
          reason,
          url: currentUrl,
          title: page.title,
          contentLength: page.content.length,
          source: page.source,
        });
      } catch (error) {
        console.error('[pocket-ai] failed readability extraction, using raw fallback', error);

        const fallbackText = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 8_000);
        const fallbackPage: PageContentMessage['payload'] = {
          title: document.title || 'Untitled page',
          url: currentUrl,
          content: fallbackText || 'Page text extraction returned empty content.',
          source: 'fallback',
          warning: 'Readability extraction failed. Using raw page text fallback.',
          selection: latestSelection || undefined,
        };

        void chrome.runtime.sendMessage({
          type: 'PAGE_CONTENT',
          payload: fallbackPage,
        } satisfies PageContentMessage);
      }
    };

    const updateSelection = () => {
      latestSelection = window.getSelection()?.toString() ?? '';
    };

    document.addEventListener('selectionchange', updateSelection);
    window.addEventListener('mouseup', updateSelection);
    window.addEventListener('keyup', updateSelection);

    const originalPushState = history.pushState.bind(history);
    history.pushState = ((...args: Parameters<History['pushState']>) => {
      originalPushState(...args);
      dispatchPageSnapshot('pushstate');
    }) as History['pushState'];

    const originalReplaceState = history.replaceState.bind(history);
    history.replaceState = ((...args: Parameters<History['replaceState']>) => {
      originalReplaceState(...args);
      dispatchPageSnapshot('replacestate');
    }) as History['replaceState'];

    window.addEventListener('popstate', () => dispatchPageSnapshot('popstate'));
    window.addEventListener('hashchange', () => dispatchPageSnapshot('hashchange'));
    window.addEventListener('load', () => dispatchPageSnapshot('load'));
    window.addEventListener('DOMContentLoaded', () => dispatchPageSnapshot('domcontentloaded'));

    window.setTimeout(() => dispatchPageSnapshot('initial-timeout'), 0);

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
          dispatchPageSnapshot('manual-request');
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
          const page = extractPageContentFromDocument(latestSelection);
          const response: GetPageContentResponse = { ok: true, page };
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
