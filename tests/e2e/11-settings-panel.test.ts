import { expect, test } from '@playwright/test';

import { closeExtensionSession, launchExtensionSession, openSidePanelPage } from './helpers/extension';

const DEFAULT_FEATURE_TOGGLES = {
  chatPanel: true,
  summarizePanel: true,
  youtubePanel: true,
  pdfPanel: true,
  ocrPanel: true,
  selectionToolbar: true,
  pageContextAutoRead: true,
  youtubeAutoFetch: true,
  ocrScreenshotFallback: true,
  carryContext: false,
};

test('disabling a panel toggle hides the rail icon', async () => {
  const session = await launchExtensionSession();

  try {
    await session.serviceWorker.evaluate(async (toggles) => {
      await chrome.storage.local.set({
        'settings.privateMode': false,
        'settings.featureToggles': toggles,
      });
    }, DEFAULT_FEATURE_TOGGLES);

    const panelPage = await openSidePanelPage(session.context, session.extensionId);
    await expect(panelPage.getByRole('tab', { name: 'YouTube' })).toHaveCount(1);

    await session.serviceWorker.evaluate(async (toggles) => {
      await chrome.storage.local.set({
        'settings.featureToggles': {
          ...toggles,
          youtubePanel: false,
        },
      });
    }, DEFAULT_FEATURE_TOGGLES);

    await expect(panelPage.getByRole('tab', { name: 'YouTube' })).toHaveCount(0);
  } finally {
    await closeExtensionSession(session);
  }
});

test('disabling selection toolbar prevents highlight UI injection', async () => {
  const session = await launchExtensionSession();

  try {
    await session.serviceWorker.evaluate(async (toggles) => {
      await chrome.storage.local.set({
        'settings.privateMode': false,
        'settings.featureToggles': {
          ...toggles,
          selectionToolbar: false,
        },
      });
    }, DEFAULT_FEATURE_TOGGLES);

    const page = await session.context.newPage();
    await page.goto('https://en.wikipedia.org/wiki/JavaScript', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      const paragraph = document.querySelector('#mw-content-text p');
      if (!paragraph) {
        return;
      }

      const range = document.createRange();
      range.selectNodeContents(paragraph);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    await expect(page.locator('.pocket-ai-selection-toolbar')).toHaveCount(0);
  } finally {
    await closeExtensionSession(session);
  }
});
