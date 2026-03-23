export type PdfParseSource = 'text' | 'ocr' | 'mixed';

export type PdfParseProgress = {
  phase: 'extract' | 'ocr';
  currentPage: number;
  totalPages: number;
};

export type PdfParseResult = {
  fileName: string;
  pageCount: number;
  pages: string[];
  text: string;
  source: PdfParseSource;
  chunks: string[];
};
