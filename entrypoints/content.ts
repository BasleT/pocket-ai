export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || message.type !== 'CONTENT_PROXY_TO_BACKGROUND') {
        return;
      }

      void chrome.runtime
        .sendMessage(message.payload)
        .then((response) => sendResponse(response))
        .catch((error) => {
          sendResponse({ error: error instanceof Error ? error.message : 'Proxy failed' });
        });

      return true;
    });
  },
});
