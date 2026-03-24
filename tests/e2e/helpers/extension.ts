import path from 'node:path';

import { chromium, expect, type BrowserContext, type Page, type Worker } from '@playwright/test';

export type ExtensionSession = {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
};

export async function launchExtensionSession(): Promise<ExtensionSession> {
  const extensionPath = path.join(process.cwd(), '.output', 'chrome-mv3');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }

  const extensionId = serviceWorker.url().split('/')[2];
  return { context, serviceWorker, extensionId };
}

export async function openSidePanelPage(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  return page;
}

export async function activateTabByUrl(serviceWorker: Worker, urlPattern: string): Promise<number> {
  const tabId = await serviceWorker.evaluate(async (pattern) => {
    const tabs = await chrome.tabs.query({ url: pattern });
    const id = tabs[0]?.id;
    if (!id) {
      return null;
    }

    await chrome.tabs.update(id, { active: true });
    return id;
  }, urlPattern);

  expect(tabId).not.toBeNull();
  return tabId as number;
}

export async function requestSnapshot(serviceWorker: Worker, tabId: number): Promise<void> {
  await serviceWorker.evaluate(async (id) => {
    await chrome.tabs.sendMessage(id, { type: 'REQUEST_PAGE_CONTENT_SNAPSHOT' });
  }, tabId);
}

export async function closeExtensionSession(session: ExtensionSession): Promise<void> {
  await session.context.close();
}
