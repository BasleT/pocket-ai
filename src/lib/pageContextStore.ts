import type { PageContentResult } from '../types/page';

export const ACTIVE_PAGE_TAB_ID_KEY = 'pageContext:activeTabId';

export function createPageContextStorageKey(tabId: number): string {
  return `pageContext:${tabId}`;
}

export function shouldExtractPageFromUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function buildFallbackPageContext(url: string): PageContentResult {
  return {
    title: 'Unsupported page',
    url,
    content: '',
    source: 'fallback',
    warning: 'This page has no extractable content for sidebar context.',
  };
}
