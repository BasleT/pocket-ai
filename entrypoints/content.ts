import { extractPageContentFromDocument } from '../src/lib/extractors/page';
import type { GetPageContentMessage, GetPageContentResponse } from '../src/types/page';

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

    chrome.runtime.onMessage.addListener((rawMessage: GetPageContentMessage, _sender, sendResponse) => {
      if (!rawMessage || rawMessage.type !== 'GET_PAGE_CONTENT') {
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
    });
  },
});
