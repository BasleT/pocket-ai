import { expect, test } from '@playwright/test';

import {
  activateTabByUrl,
  closeExtensionSession,
  launchExtensionSession,
  openSidePanelPage,
} from './helpers/extension';

test('selection toolbar Explain action opens/sends to chat', async () => {
  test.slow();
  const session = await launchExtensionSession();

  try {
    const pageLogs: string[] = [];
    const wikiPage = await session.context.newPage();
    wikiPage.on('console', (message) => {
      pageLogs.push(message.text());
    });

    await wikiPage.goto('https://en.wikipedia.org/wiki/JavaScript', { waitUntil: 'domcontentloaded' });
    await wikiPage.waitForLoadState('networkidle');

    const tabId = await activateTabByUrl(session.serviceWorker, '*://en.wikipedia.org/wiki/JavaScript*');

    await wikiPage.evaluate(() => {
      const paragraph = Array.from(document.querySelectorAll('#mw-content-text p')).find(
        (item) => (item.textContent ?? '').trim().length > 120,
      );
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

    await session.serviceWorker.evaluate(async (id) => {
      await chrome.tabs.update(id, { active: true });
    }, tabId);

    await expect(wikiPage.locator('.pocket-ai-selection-toolbar')).toBeVisible({ timeout: 10_000 });
    await wikiPage.locator('.pocket-ai-selection-toolbar button', { hasText: 'Explain' }).click();
    await expect(wikiPage.locator('.pocket-ai-selection-toolbar')).toBeHidden({ timeout: 10_000 });

    await expect
      .poll(async () => {
        return session.serviceWorker.evaluate(async () => {
          const stored = await chrome.storage.session.get('chat:pendingSelectionPrompt');
          return Boolean(stored['chat:pendingSelectionPrompt']);
        });
      }, { timeout: 10_000 })
      .toBe(true);

    const panelPage = await openSidePanelPage(session.context, session.extensionId);

    expect(pageLogs.some((line) => line.includes('toolbar click: Explain'))).toBe(true);
    await expect(async () => {
      await expect(panelPage.getByText(/Explain this:/i)).toBeVisible({ timeout: 5_000 });
    }).toPass({
      intervals: [100, 200, 500, 1000],
      timeout: 30_000,
    });
  } finally {
    await closeExtensionSession(session);
  }
});
