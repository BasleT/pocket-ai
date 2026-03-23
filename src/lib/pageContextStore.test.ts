import { describe, expect, it } from 'vitest';

import {
  ACTIVE_PAGE_TAB_ID_KEY,
  buildFallbackPageContext,
  createPageContextStorageKey,
  createPreviousPageContextStorageKey,
  shouldExtractPageFromUrl,
} from './pageContextStore';

describe('pageContextStore helpers', () => {
  it('creates deterministic storage key per tab', () => {
    expect(createPageContextStorageKey(42)).toBe('pageContext:42');
  });

  it('creates deterministic previous-page key per tab', () => {
    expect(createPreviousPageContextStorageKey(42)).toBe('pageContext:42:previous');
  });

  it('provides a stable active-tab storage key', () => {
    expect(ACTIVE_PAGE_TAB_ID_KEY).toBe('pageContext:activeTabId');
  });

  it('filters non-http urls from extraction', () => {
    expect(shouldExtractPageFromUrl('https://example.com')).toBe(true);
    expect(shouldExtractPageFromUrl('http://example.com')).toBe(true);
    expect(shouldExtractPageFromUrl('chrome://extensions')).toBe(false);
    expect(shouldExtractPageFromUrl('about:blank')).toBe(false);
    expect(shouldExtractPageFromUrl('not-a-url')).toBe(false);
  });

  it('builds graceful fallback context for unsupported pages', () => {
    const fallback = buildFallbackPageContext('chrome://extensions');

    expect(fallback.title).toBe('Unsupported page');
    expect(fallback.url).toBe('chrome://extensions');
    expect(fallback.source).toBe('fallback');
    expect(fallback.warning).toContain('extractable content');
  });
});
