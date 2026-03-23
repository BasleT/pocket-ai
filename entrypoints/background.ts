export default defineBackground(() => {
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
});
