import type { PageContentResult } from '../types/page';

export const ACTIVE_PAGE_TAB_ID_KEY = 'pageContext:activeTabId';

export function createPageContextStorageKey(tabId: number): string {
  return `pageContext:${tabId}`;
}

export function createPreviousPageContextStorageKey(tabId: number): string {
  return `pageContext:${tabId}:previous`;
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
    content: `No readable article content was available for ${url || 'this page'}. Use visible text or navigate to a standard webpage for richer context.`,
    source: 'fallback',
    warning: 'This page has no extractable content for sidebar context.',
  };
}
