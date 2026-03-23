import { describe, expect, it } from 'vitest';

import {
  DEFAULT_OCR_LANGUAGE,
  normalizeOcrLanguage,
  normalizeOcrText,
  resolveOcrInput,
} from './ocr';

describe('normalizeOcrText', () => {
  it('collapses whitespace and trims output', () => {
    expect(normalizeOcrText('  one\n\n two   three  ')).toBe('one two three');
  });
});

describe('normalizeOcrLanguage', () => {
  it('uses English as default when language is empty', () => {
    expect(normalizeOcrLanguage('')).toBe(DEFAULT_OCR_LANGUAGE);
  });

  it('passes through supported language values', () => {
    expect(normalizeOcrLanguage('spa')).toBe('spa');
  });
});

describe('resolveOcrInput', () => {
  it('keeps blob input as-is', () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    expect(resolveOcrInput(blob)).toBe(blob);
  });

  it('accepts http image urls', () => {
    expect(resolveOcrInput('https://example.com/image.png')).toBe('https://example.com/image.png');
  });

  it('accepts base64 screenshot data urls', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
    expect(resolveOcrInput(dataUrl)).toBe(dataUrl);
  });

  it('rejects unsupported url protocols', () => {
    expect(() => resolveOcrInput('file:///tmp/a.png')).toThrow('Unsupported image URL protocol');
  });
});
