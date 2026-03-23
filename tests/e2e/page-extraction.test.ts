import path from 'node:path';

import { chromium, expect, test, type BrowserContext, type Page, type Worker } from '@playwright/test';

async function launchExtensionContext(): Promise<{
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
}> {
  const extensionPath = path.join(process.cwd(), '.output', 'chrome-mv3');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: false,
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

async function openSidePanelPage(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('domcontentloaded');
  return page;
}

test('BUG1: extraction captures full page context beyond initial viewport', async () => {
  const { context, serviceWorker, extensionId } = await launchExtensionContext();

  try {
    const pageLogs: string[] = [];

    const wikiPage = await context.newPage();
    wikiPage.on('console', (message) => {
      pageLogs.push(message.text());
    });
    await wikiPage.goto('https://en.wikipedia.org/wiki/JavaScript', { waitUntil: 'domcontentloaded' });
    await wikiPage.waitForLoadState('networkidle');

    const wikiTabId = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: '*://en.wikipedia.org/wiki/JavaScript*' });
      return tabs[0]?.id ?? null;
    });
    expect(wikiTabId).not.toBeNull();

    const panelPage = await openSidePanelPage(context, extensionId);
    await serviceWorker.evaluate(async (tabId) => {
      if (!tabId) {
        throw new Error('Missing wikipedia tab ID');
      }

      await chrome.tabs.update(tabId, { active: true });
      await chrome.tabs.sendMessage(tabId, { type: 'REQUEST_PAGE_CONTENT_SNAPSHOT' });
    }, wikiTabId);

    await expect(panelPage.getByText(/JavaScript/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(panelPage.getByPlaceholder('Ask about this page...')).toBeVisible({ timeout: 20_000 });
    await expect(panelPage.getByRole('button', { name: /Re-read page/i })).toBeVisible({ timeout: 20_000 });

    const storedPage = await serviceWorker.evaluate(async () => {
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
    await context.close();
  }
});

test('BUG4: selection toolbar Explain action opens/sends to chat', async () => {
  const { context, serviceWorker, extensionId } = await launchExtensionContext();

  try {
    const pageLogs: string[] = [];
    const wikiPage = await context.newPage();
    wikiPage.on('console', (message) => {
      pageLogs.push(message.text());
    });
    await wikiPage.goto('https://en.wikipedia.org/wiki/JavaScript', { waitUntil: 'domcontentloaded' });
    await wikiPage.waitForLoadState('networkidle');

    const wikiTabId = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: '*://en.wikipedia.org/wiki/JavaScript*' });
      return tabs[0]?.id ?? null;
    });
    expect(wikiTabId).not.toBeNull();

    await wikiPage.evaluate(() => {
      const paragraphs = Array.from(document.querySelectorAll('#mw-content-text p'));
      const paragraph = paragraphs.find((item) => (item.textContent ?? '').trim().length > 120);
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

    await expect(wikiPage.locator('.pocket-ai-selection-toolbar')).toBeVisible({ timeout: 10_000 });
    await wikiPage.locator('.pocket-ai-selection-toolbar button', { hasText: 'Explain' }).click();
    await expect(wikiPage.locator('.pocket-ai-selection-toolbar')).toBeHidden({ timeout: 10_000 });

    const panelPage = await openSidePanelPage(context, extensionId);
    await serviceWorker.evaluate(async (tabId) => {
      if (!tabId) {
        throw new Error('Missing wikipedia tab ID');
      }
      await chrome.tabs.update(tabId, { active: true });
    }, wikiTabId);

    const pendingSelectionState = await serviceWorker.evaluate(async () => {
      return chrome.storage.session.get(['chat:pendingSelectionPrompt']);
    });
    console.log('[e2e] wiki logs:', JSON.stringify(pageLogs.slice(-20)));
    console.log('[e2e] pending selection state:', JSON.stringify(pendingSelectionState));

    const panelText = await panelPage.locator('body').innerText();
    console.log('[e2e] panel body text:', panelText.slice(0, 500));

    await expect(panelPage.getByText(/Explain this:/i)).toBeVisible({ timeout: 20_000 });
  } finally {
    await context.close();
  }
});

test('BUG3: carry-over preserves previous page context and surfaces header chip', async () => {
  const { context, serviceWorker, extensionId } = await launchExtensionContext();

  try {
    await serviceWorker.evaluate(async () => {
      await chrome.storage.local.set({ carryContext: true });
    });

    const firstPage = await context.newPage();
    await firstPage.goto('https://en.wikipedia.org/wiki/JavaScript', { waitUntil: 'domcontentloaded' });
    await firstPage.waitForLoadState('networkidle');

    const firstTabId = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: '*://en.wikipedia.org/wiki/JavaScript*' });
      return tabs[0]?.id ?? null;
    });
    expect(firstTabId).not.toBeNull();

    await serviceWorker.evaluate(async (tabId) => {
      if (!tabId) {
        throw new Error('Missing first tab ID');
      }
      await chrome.tabs.update(tabId, { active: true });
      await chrome.tabs.sendMessage(tabId, { type: 'REQUEST_PAGE_CONTENT_SNAPSHOT' });
    }, firstTabId);

    await firstPage.goto('https://en.wikipedia.org/wiki/TypeScript', { waitUntil: 'domcontentloaded' });
    await firstPage.waitForLoadState('networkidle');

    await serviceWorker.evaluate(async (tabId) => {
      if (!tabId) {
        throw new Error('Missing second tab ID');
      }
      await chrome.tabs.sendMessage(tabId, { type: 'REQUEST_PAGE_CONTENT_SNAPSHOT' });
    }, firstTabId);

    const contextSnapshot = await serviceWorker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        return null;
      }

      const currentKey = `pageContext:${tab.id}`;
      const previousKey = `pageContext:${tab.id}:previous`;
      const stored = await chrome.storage.session.get([currentKey, previousKey]);
      return {
        current: stored[currentKey] as { title?: string; content?: string } | undefined,
        previous: stored[previousKey] as { title?: string; content?: string } | undefined,
      };
    });

    expect(contextSnapshot?.current?.title ?? '').toContain('TypeScript');
    expect(contextSnapshot?.previous?.title ?? '').toContain('JavaScript');

    const panelPage = await openSidePanelPage(context, extensionId);
    await serviceWorker.evaluate(async (tabId) => {
      if (!tabId) {
        throw new Error('Missing active tab for panel sync');
      }
      await chrome.tabs.update(tabId, { active: true });
    }, firstTabId);

    await expect(panelPage.getByText(/TypeScript \+ JavaScript/)).toBeVisible({ timeout: 20_000 });
    await expect(panelPage.getByText(/Carrying context from: JavaScript/)).toBeVisible({ timeout: 20_000 });
  } finally {
    await context.close();
  }
});

test('BUG2: OCR fallback provides context when DOM extraction is too short', async () => {
  test.setTimeout(60_000);
  const { context, serviceWorker } = await launchExtensionContext();

  try {
    const page = await context.newPage();
    await page.goto('https://en.wikipedia.org/wiki/JavaScript', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const tabId = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: '*://en.wikipedia.org/wiki/JavaScript*' });
      return tabs[0]?.id ?? null;
    });
    expect(tabId).not.toBeNull();

    await serviceWorker.evaluate(async (id) => {
      if (!id) {
        throw new Error('Missing target tab');
      }
      await chrome.tabs.update(id, { active: true });
    }, tabId);

    await page.evaluate(() => {
      document.body.innerHTML = '';
      const canvas = document.createElement('canvas');
      canvas.width = 1800;
      canvas.height = 900;
      const context2d = canvas.getContext('2d');
      if (!context2d) {
        return;
      }

      context2d.fillStyle = '#ffffff';
      context2d.fillRect(0, 0, canvas.width, canvas.height);
      context2d.fillStyle = '#111111';
      context2d.font = '42px Arial';

      const line = 'OCR fallback should capture this canvas-only text as page context for pocket ai.';
      for (let i = 0; i < 10; i += 1) {
        context2d.fillText(line, 20, 80 + i * 70);
      }

      document.body.appendChild(canvas);
    });

    await serviceWorker.evaluate(async (id) => {
      if (!id) {
        throw new Error('Missing target tab');
      }

      await chrome.tabs.sendMessage(id, { type: 'REQUEST_PAGE_CONTENT_SNAPSHOT' });
    }, tabId);

    await page.waitForTimeout(8000);

    const storedPage = await serviceWorker.evaluate(async () => {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id) {
        return null;
      }

      const key = `pageContext:${activeTab.id}`;
      const stored = await chrome.storage.session.get(key);
      return stored[key] as { source?: string; content?: string; warning?: string } | null;
    });

    expect(storedPage).not.toBeNull();
    expect(storedPage?.source).toBe('ocr');
    expect(storedPage?.content?.length ?? 0).toBeGreaterThan(100);
    expect(storedPage?.warning ?? '').toContain('OCR screenshot');

    const panelPage = await openSidePanelPage(context, serviceWorker.url().split('/')[2]);
    await serviceWorker.evaluate(async (id) => {
      if (!id) {
        throw new Error('Missing OCR tab id');
      }
      await chrome.tabs.update(id, { active: true });
    }, tabId);
    await expect(panelPage.getByText(/OCR/).first()).toBeVisible({ timeout: 20_000 });
  } finally {
    await context.close();
  }
});
