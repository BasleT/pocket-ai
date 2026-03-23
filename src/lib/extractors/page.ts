import { Readability } from '@mozilla/readability';

import type { PageContentResult } from '../../types/page';

const MAX_CONTEXT_CHARS = 12_000;

export type ReadabilityLikeResult = {
  title?: string | null;
  textContent?: string | null;
  excerpt?: string | null;
};

type BuildPageContentInput = {
  readability: ReadabilityLikeResult | null;
  fallbackTitle: string;
  fallbackText: string;
  url: string;
  selectionText: string;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxLength = MAX_CONTEXT_CHARS): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

export function buildPageContent(input: BuildPageContentInput): PageContentResult {
  const readableTitle = normalizeText(input.readability?.title);
  const readableText = normalizeText(input.readability?.textContent);
  const readableExcerpt = normalizeText(input.readability?.excerpt);

  const fallbackTitle = normalizeText(input.fallbackTitle) || 'Untitled page';
  const fallbackText = normalizeText(input.fallbackText);

  const hasReadableContent = readableText.length > 120;

  const content = truncateText(hasReadableContent ? readableText : fallbackText);
  const title = readableTitle || fallbackTitle;
  const selection = normalizeText(input.selectionText);

  return {
    title,
    url: input.url,
    content,
    excerpt: readableExcerpt || undefined,
    selection: selection || undefined,
    source: hasReadableContent ? 'readability' : 'fallback',
    warning: hasReadableContent
      ? undefined
      : 'Using page fallback content because article extraction was limited on this page.',
  };
}

export function buildPageSummarizePrompt(page: PageContentResult): string {
  const selectionBlock = page.selection
    ? `\n\nSelected text:\n${page.selection}`
    : '\n\nSelected text: (none)';

  return [
    'Summarize this page and highlight key points in concise bullet points.',
    `Title: ${page.title}`,
    `URL: ${page.url}`,
    `Source: ${page.source}`,
    `Content:\n${page.content}`,
    selectionBlock,
  ].join('\n\n');
}

export function extractPageContentFromDocument(selectionText: string): PageContentResult {
  const fallbackTitle = document.title;
  const fallbackText = document.body?.innerText ?? '';
  const url = window.location.href;

  let readabilityResult: ReadabilityLikeResult | null = null;

  try {
    const documentClone = document.cloneNode(true) as Document;
    readabilityResult = new Readability(documentClone).parse();
  } catch {
    readabilityResult = null;
  }

  return buildPageContent({
    readability: readabilityResult,
    fallbackTitle,
    fallbackText,
    url,
    selectionText,
  });
}
