import { describe, expect, it } from 'vitest';

import {
  buildPdfSystemContext,
  chunkPdfText,
  createRollingContextWindow,
  shouldUseOcrFallback,
} from './pdf';

describe('chunkPdfText', () => {
  it('splits long text into bounded chunks', () => {
    const text = Array.from({ length: 500 }, (_, index) => `word-${index}`).join(' ');
    const chunks = chunkPdfText(text, 600);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 600)).toBe(true);
  });
});

describe('createRollingContextWindow', () => {
  it('keeps most recent chunks and reports omitted count', () => {
    const chunks = ['a', 'b', 'c', 'd', 'e'];
    const window = createRollingContextWindow(chunks, 3);

    expect(window.includedChunks).toEqual(['c', 'd', 'e']);
    expect(window.omittedChunks).toBe(2);
  });
});

describe('shouldUseOcrFallback', () => {
  it('returns true when extraction content is effectively empty', () => {
    expect(shouldUseOcrFallback(['', ' ', 'short'])).toBe(true);
  });

  it('returns false when extraction has enough text', () => {
    expect(
      shouldUseOcrFallback([
        'This page has substantial selectable text that should disable OCR fallback.',
      ]),
    ).toBe(false);
  });
});

describe('buildPdfSystemContext', () => {
  it('includes metadata and rolling transcript context', () => {
    const context = buildPdfSystemContext({
      fileName: 'sample.pdf',
      pageCount: 4,
      source: 'ocr',
      chunks: ['chunk 1', 'chunk 2', 'chunk 3', 'chunk 4'],
      maxContextChunks: 2,
    });

    expect(context).toContain('sample.pdf');
    expect(context).toContain('page count: 4');
    expect(context).toContain('source: ocr');
    expect(context).toContain('chunk 3');
    expect(context).toContain('chunk 4');
  });
});
