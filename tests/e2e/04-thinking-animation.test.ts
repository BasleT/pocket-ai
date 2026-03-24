import { expect, test } from '@playwright/test';

import {
  closeExtensionSession,
  launchExtensionSession,
  openSidePanelPage,
} from './helpers/extension';

test('thinking trace button uses border glow animation', async () => {
  const session = await launchExtensionSession();

  try {
    const sidePanel = await openSidePanelPage(session.context, session.extensionId);

    const styles = await sidePanel.evaluate(() => {
      const cssRules: string[] = [];

      for (const styleSheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(styleSheet.cssRules)) {
            cssRules.push(rule.cssText);
          }
        } catch {
          // Ignore inaccessible style sheets.
        }
      }

      const traceRule = cssRules.find((rule) => rule.includes('.ui-btn-trace::before')) ?? '';
      const bubbleRule = cssRules.find((rule) => rule.includes('.thinking-bubble::before')) ?? '';

      return { traceRule, bubbleRule };
    });

    expect(styles.traceRule).toContain('conic-gradient');
    expect(styles.traceRule).toContain('thinking-spin');
    expect(styles.traceRule).toContain('drop-shadow');
    expect(styles.traceRule).toContain('pointer-events: none');
    expect(styles.bubbleRule).toContain('conic-gradient');
  } finally {
    await closeExtensionSession(session);
  }
});
