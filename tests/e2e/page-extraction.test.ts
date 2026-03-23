import path from 'node:path';

import { chromium, expect, test } from '@playwright/test';

test('shows wikipedia page context in sidepanel', async () => {
  const extensionPath = path.join(process.cwd(), '.output', 'chrome-mv3');

  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const wikiConsoleLogs: string[] = [];

    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }

    const extensionId = serviceWorker.url().split('/')[2];

    const wikiPage = await context.newPage();
    wikiPage.on('console', (message) => {
      const text = message.text();
      if (text.includes('[pocket-ai]')) {
        wikiConsoleLogs.push(text);
      }
    });

    await wikiPage.goto('https://wikipedia.org/wiki/JavaScript', { waitUntil: 'domcontentloaded' });
    await wikiPage.waitForLoadState('networkidle');

    const wikiTabId = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: '*://*.wikipedia.org/wiki/JavaScript*' });
      return tabs[0]?.id ?? null;
    });

    expect(wikiTabId).not.toBeNull();

    const panelPage = await context.newPage();
    await panelPage.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: 'domcontentloaded',
    });
    await panelPage.waitForLoadState('domcontentloaded');

    await serviceWorker.evaluate(async (tabId) => {
      if (!tabId) {
        throw new Error('Missing wikipedia tab ID');
      }

      await chrome.tabs.update(tabId, { active: true });
    }, wikiTabId);

    await panelPage.waitForTimeout(1500);

    const getPageContentResult = await serviceWorker.evaluate(async () => {
      const response = await chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTENT' });
      return response as { ok: boolean; page?: { title: string; source: string; content: string } };
    });

    console.log('[e2e] GET_PAGE_CONTENT response:', JSON.stringify(getPageContentResult));
    console.log('[e2e] wikipedia page console logs:', JSON.stringify(wikiConsoleLogs));

    const panelBodyText = await panelPage.locator('body').innerText();
    console.log('[e2e] sidepanel body:', panelBodyText.slice(0, 400));

    await expect(panelPage.getByText(/JavaScript/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(panelPage.getByPlaceholder('Ask about this page...')).toBeVisible({ timeout: 20_000 });

    expect(extensionId).toBeTruthy();
  } finally {
    await context.close();
  }
});
