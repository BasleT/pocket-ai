import { expect, test } from '@playwright/test';

import {
  activateTabByUrl,
  closeExtensionSession,
  launchExtensionSession,
  openSidePanelPage,
  requestSnapshot,
} from './helpers/extension';

test('captures full-page extraction context beyond viewport', async () => {
  const session = await launchExtensionSession();

  try {
    const wikiPage = await session.context.newPage();
    await wikiPage.goto('https://en.wikipedia.org/wiki/JavaScript', { waitUntil: 'domcontentloaded' });
    await wikiPage.waitForLoadState('networkidle');

    const tabId = await activateTabByUrl(session.serviceWorker, '*://en.wikipedia.org/wiki/JavaScript*');
    await requestSnapshot(session.serviceWorker, tabId);

    await expect
      .poll(async () => {
        return session.serviceWorker.evaluate(async () => {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab?.id) {
            return 0;
          }

          const key = `pageContext:${tab.id}`;
          const stored = await chrome.storage.session.get(key);
          const page = stored[key] as { content?: string } | undefined;
          return page?.content?.length ?? 0;
        });
      }, { timeout: 20_000 })
      .toBeGreaterThan(19_000);

    const panelPage = await openSidePanelPage(session.context, session.extensionId);
    await session.serviceWorker.evaluate(async (id) => {
      await chrome.tabs.update(id, { active: true });
    }, tabId);
    await expect(panelPage.getByText(/JavaScript/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(panelPage.getByPlaceholder('Ask about this page...')).toBeVisible({ timeout: 20_000 });

    const storedPage = await session.serviceWorker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        return null;
      }

      const key = `pageContext:${tab.id}`;
      const stored = await chrome.storage.session.get(key);
      return stored[key] as { content: string; title: string; source: string } | null;
    });

    expect(storedPage).not.toBeNull();
    expect(storedPage?.title ?? '').toContain('JavaScript');
    expect(storedPage?.content.length ?? 0).toBeGreaterThan(19_000);
  } finally {
    await closeExtensionSession(session);
  }
});
