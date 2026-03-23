import { describe, expect, it } from 'vitest';

import {
  buildPageContent,
  buildPageSummarizePrompt,
  type ReadabilityLikeResult,
} from './page';

describe('buildPageContent', () => {
  it('prefers readability text when available', () => {
    const readability: ReadabilityLikeResult = {
      title: 'Readable title',
      textContent:
        'Primary article text with enough detail to pass extraction confidence threshold and avoid fallback mode. ' +
        'This adds additional sentence length so readability remains the preferred extraction source in tests.',
      excerpt: 'Short summary',
    };

    const result = buildPageContent({
      readability,
      fallbackTitle: 'Fallback title',
      fallbackText: 'Fallback body text',
      url: 'https://example.com/article',
      selectionText: '',
    });

    expect(result.title).toBe('Readable title');
    expect(result.content).toContain('Primary article text');
    expect(result.source).toBe('readability');
    expect(result.warning).toBeUndefined();
  });

  it('falls back to page text when readability is empty', () => {
    const result = buildPageContent({
      readability: null,
      fallbackTitle: 'Fallback title',
      fallbackText: 'Fallback body text',
      url: 'https://example.com/fallback',
      selectionText: '',
    });

    expect(result.title).toBe('Fallback title');
    expect(result.content).toBe('Fallback body text');
    expect(result.source).toBe('fallback');
    expect(result.warning).toContain('Using page fallback content');
  });

  it('includes trimmed user selection when present', () => {
    const result = buildPageContent({
      readability: null,
      fallbackTitle: 'Page title',
      fallbackText: 'Page body',
      url: 'https://example.com/selection',
      selectionText: '  Selected phrase  ',
    });

    expect(result.selection).toBe('Selected phrase');
  });
});

describe('buildPageSummarizePrompt', () => {
  it('builds prompt with title, url, content and selection', () => {
    const prompt = buildPageSummarizePrompt({
      title: 'Page title',
      url: 'https://example.com/page',
      content: 'Important page content.',
      source: 'readability',
      selection: 'Highlighted sentence',
    });

    expect(prompt).toContain('Summarize this page');
    expect(prompt).toContain('Page title');
    expect(prompt).toContain('https://example.com/page');
    expect(prompt).toContain('Important page content.');
    expect(prompt).toContain('Highlighted sentence');
  });
});
