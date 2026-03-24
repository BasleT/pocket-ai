import { expect, test } from '@playwright/test';

import {
  activateTabByUrl,
  closeExtensionSession,
  launchExtensionSession,
  openSidePanelPage,
  requestSnapshot,
} from './helpers/extension';

test('OCR fallback provides page context when extraction is too short', async () => {
  test.setTimeout(60_000);
  const session = await launchExtensionSession();

  try {
    const page = await session.context.newPage();
    await page.goto('https://en.wikipedia.org/wiki/JavaScript', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const tabId = await activateTabByUrl(session.serviceWorker, '*://en.wikipedia.org/wiki/JavaScript*');

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

    await requestSnapshot(session.serviceWorker, tabId);
    await page.waitForTimeout(8000);

    const storedPage = await session.serviceWorker.evaluate(async () => {
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

    const panelPage = await openSidePanelPage(session.context, session.extensionId);
    await session.serviceWorker.evaluate(async (id) => {
      await chrome.tabs.update(id, { active: true });
    }, tabId);
    await expect(panelPage.getByText(/OCR/).first()).toBeVisible({ timeout: 20_000 });
  } finally {
    await closeExtensionSession(session);
  }
});
