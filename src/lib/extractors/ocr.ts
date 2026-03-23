export const DEFAULT_OCR_LANGUAGE = 'eng';

export const OCR_LANGUAGES = [
  { id: 'eng', label: 'English' },
  { id: 'spa', label: 'Spanish' },
  { id: 'fra', label: 'French' },
  { id: 'deu', label: 'German' },
  { id: 'ita', label: 'Italian' },
  { id: 'por', label: 'Portuguese' },
] as const;

export type OcrLanguage = (typeof OCR_LANGUAGES)[number]['id'];

export type OcrInput = string | Blob;

export function normalizeOcrText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeOcrLanguage(language: string | undefined): OcrLanguage {
  if (!language) {
    return DEFAULT_OCR_LANGUAGE;
  }

  const found = OCR_LANGUAGES.find((item) => item.id === language);
  return found?.id ?? DEFAULT_OCR_LANGUAGE;
}

export function resolveOcrInput(input: OcrInput): OcrInput {
  if (input instanceof Blob) {
    return input;
  }

  if (input.startsWith('data:image/')) {
    return input;
  }

  const parsed = new URL(input);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Unsupported image URL protocol');
  }

  return input;
}

export async function recognizeCanvasText(
  canvas: HTMLCanvasElement,
  language: OcrLanguage = DEFAULT_OCR_LANGUAGE,
): Promise<string> {
  const { recognize } = await import('tesseract.js');
  const result = await recognize(canvas, language);
  return normalizeOcrText(result.data.text);
}

export async function recognizeImageText(
  input: OcrInput,
  language: OcrLanguage = DEFAULT_OCR_LANGUAGE,
): Promise<string> {
  const resolvedInput = resolveOcrInput(input);
  const { recognize } = await import('tesseract.js');
  const result = await recognize(resolvedInput, normalizeOcrLanguage(language));
  return normalizeOcrText(result.data.text);
}
