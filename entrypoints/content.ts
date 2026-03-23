import { extractPageContentFromDocument } from '../src/lib/extractors/page';
import type {
  GetPageContentMessage,
  GetPageContentResponse,
  PageContentMessage,
  RequestPageContentSnapshotMessage,
} from '../src/types/page';
import type { GetYouTubeVideoInfoMessage, GetYouTubeVideoInfoResponse } from '../src/types/youtube';
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
    let latestSelection = '';
    let lastDispatchedUrl = '';

    const dispatchPageSnapshot = () => {
      const currentUrl = window.location.href;

      if (!shouldExtractPageFromUrl(currentUrl)) {
        return;
      }

      if (lastDispatchedUrl === currentUrl) {
        return;
      }

      try {
        const page = extractPageContentFromDocument(latestSelection);
        const message: PageContentMessage = {
          type: 'PAGE_CONTENT',
          payload: page,
        };

        void chrome.runtime.sendMessage(message);
        lastDispatchedUrl = currentUrl;
      } catch {
        // Ignore extraction failures in content script.
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
      dispatchPageSnapshot();
    }) as History['pushState'];

    const originalReplaceState = history.replaceState.bind(history);
    history.replaceState = ((...args: Parameters<History['replaceState']>) => {
      originalReplaceState(...args);
      dispatchPageSnapshot();
    }) as History['replaceState'];

    window.addEventListener('popstate', dispatchPageSnapshot);
    window.addEventListener('hashchange', dispatchPageSnapshot);
    window.addEventListener('load', dispatchPageSnapshot);

    window.setTimeout(dispatchPageSnapshot, 0);

    chrome.runtime.onMessage.addListener(
      (
        rawMessage:
          | GetPageContentMessage
          | GetYouTubeVideoInfoMessage
          | RequestPageContentSnapshotMessage,
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
          dispatchPageSnapshot();
          sendResponse({ ok: true });
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
