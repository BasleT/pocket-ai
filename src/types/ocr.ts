import type { OcrLanguage } from '../lib/extractors/ocr';

export const OCR_RESULT_STORAGE_KEY = 'ocrLastResult';
export const OCR_LANGUAGE_STORAGE_KEY = 'ocrLanguage';
export const OCR_CONTEXT_MENU_ID = 'extract-image-text';

export type OcrResult = {
  text: string;
  language: OcrLanguage;
  imageUrl: string;
  capturedAt: number;
  error?: string;
};

export type OcrUpdatedMessage = {
  type: 'OCR_RESULT_UPDATED';
  result: OcrResult;
};
