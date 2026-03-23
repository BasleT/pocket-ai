import { registerEmbedRules } from '../src/lib/declarativeRules';

async function syncEmbedRules(): Promise<void> {
  try {
    await registerEmbedRules();
  } catch (error) {
    console.error('Failed to register embed rules', error);
  }
}

export default defineBackground(() => {
  void syncEmbedRules();

  chrome.runtime.onInstalled.addListener(() => {
    void syncEmbedRules();
  });

  chrome.runtime.onStartup.addListener(() => {
    void syncEmbedRules();
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
    } catch (error) {
      console.error('Failed to open side panel', error);
    }
  });
});
