import { extractPageContentFromDocument } from '../src/lib/extractors/page';
import type { GetPageContentMessage, GetPageContentResponse } from '../src/types/page';
import type { GetYouTubeVideoInfoMessage, GetYouTubeVideoInfoResponse } from '../src/types/youtube';

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

    const updateSelection = () => {
      latestSelection = window.getSelection()?.toString() ?? '';
    };

    document.addEventListener('selectionchange', updateSelection);
    window.addEventListener('mouseup', updateSelection);
    window.addEventListener('keyup', updateSelection);

    chrome.runtime.onMessage.addListener(
      (
        rawMessage: GetPageContentMessage | GetYouTubeVideoInfoMessage,
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
