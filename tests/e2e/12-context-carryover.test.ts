import { expect, test } from '@playwright/test';

import {
  activateTabByUrl,
  closeExtensionSession,
  launchExtensionSession,
  openSidePanelPage,
  requestSnapshot,
} from './helpers/extension';

test('carry-over stores previous page and surfaces chat chip', async () => {
  const session = await launchExtensionSession();

  try {
    await session.serviceWorker.evaluate(async () => {
      await chrome.storage.local.set({ carryContext: true });
    });

    const page = await session.context.newPage();
    await page.goto('https://en.wikipedia.org/wiki/JavaScript', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const tabId = await activateTabByUrl(session.serviceWorker, '*://en.wikipedia.org/wiki/JavaScript*');
    await requestSnapshot(session.serviceWorker, tabId);

    await page.goto('https://en.wikipedia.org/wiki/TypeScript', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await requestSnapshot(session.serviceWorker, tabId);

    const contextSnapshot = await session.serviceWorker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        return null;
      }

      const currentKey = `pageContext:${tab.id}`;
      const previousKey = `pageContext:${tab.id}:previous`;
      const stored = await chrome.storage.session.get([currentKey, previousKey]);
      return {
        current: stored[currentKey] as { title?: string } | undefined,
        previous: stored[previousKey] as { title?: string } | undefined,
      };
    });

    expect(contextSnapshot?.current?.title ?? '').toContain('TypeScript');
    expect(contextSnapshot?.previous?.title ?? '').toContain('JavaScript');

    const panelPage = await openSidePanelPage(session.context, session.extensionId);
    await session.serviceWorker.evaluate(async (id) => {
      await chrome.tabs.update(id, { active: true });
    }, tabId);

    await expect(panelPage.getByText(/TypeScript \+ JavaScript/)).toBeVisible({ timeout: 20_000 });
    await expect(panelPage.getByText(/Carrying context from: JavaScript/)).toBeVisible({ timeout: 20_000 });
  } finally {
    await closeExtensionSession(session);
  }
});
