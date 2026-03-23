import { recognizeCanvasText } from './ocr';
import type { OcrLanguage } from './ocr';
import type { PdfParseProgress, PdfParseResult, PdfParseSource } from '../../types/pdf';

const DEFAULT_CHUNK_SIZE = 3_200;
const DEFAULT_MAX_CONTEXT_CHUNKS = 6;

type ParsePdfOptions = {
  onProgress?: (progress: PdfParseProgress) => void;
  ocrLanguage?: OcrLanguage;
  chunkSize?: number;
};

type BuildPdfSystemContextInput = {
  fileName: string;
  pageCount: number;
  source: PdfParseSource;
  chunks: string[];
  maxContextChunks?: number;
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function chunkPdfText(text: string, maxChunkLength = DEFAULT_CHUNK_SIZE): string[] {
  const words = normalizeText(text).split(' ').filter(Boolean);
  if (words.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let currentChunk = '';

  for (const word of words) {
    const candidate = currentChunk.length > 0 ? `${currentChunk} ${word}` : word;
    if (candidate.length > maxChunkLength && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = word;
    } else {
      currentChunk = candidate;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export function createRollingContextWindow(chunks: string[], maxChunks = DEFAULT_MAX_CONTEXT_CHUNKS): {
  includedChunks: string[];
  omittedChunks: number;
} {
  if (chunks.length <= maxChunks) {
    return { includedChunks: chunks, omittedChunks: 0 };
  }

  const startIndex = chunks.length - maxChunks;
  return {
    includedChunks: chunks.slice(startIndex),
    omittedChunks: startIndex,
  };
}

export function shouldUseOcrFallback(pageTexts: string[], minExtractedChars = 60): boolean {
  const totalChars = pageTexts.reduce((total, pageText) => total + normalizeText(pageText).length, 0);
  return totalChars < minExtractedChars;
}

export function buildPdfSystemContext(input: BuildPdfSystemContextInput): string {
  const windowed = createRollingContextWindow(input.chunks, input.maxContextChunks);
  const chunkText = windowed.includedChunks
    .map((chunk, index) => `Chunk ${index + 1}:\n${chunk}`)
    .join('\n\n');

  const omittedNote =
    windowed.omittedChunks > 0
      ? `\n\nNote: ${windowed.omittedChunks} earlier chunks were omitted for context limits.`
      : '';

  return [
    'You are assisting with an uploaded PDF document.',
    `PDF file: ${input.fileName}`,
    `PDF page count: ${input.pageCount}`,
    `PDF extraction source: ${input.source}`,
    `PDF context:\n\n${chunkText}${omittedNote}`,
  ].join('\n\n');
}

export async function parsePdfFile(file: File, options: ParsePdfOptions = {}): Promise<PdfParseResult> {
  const pdfjs = await import('pdfjs-dist');
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument(
    {
      data: new Uint8Array(arrayBuffer),
      disableWorker: true,
    } as unknown as Parameters<typeof pdfjs.getDocument>[0],
  );

  const pdfDocument = await loadingTask.promise;
  const totalPages = pdfDocument.numPages;
  const extractedPageTexts: string[] = [];

  for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
    const page = await pdfDocument.getPage(pageIndex);
    const textContent = await page.getTextContent();
    const pageText = normalizeText(
      textContent.items
        .map((item) => ('str' in item ? String(item.str) : ''))
        .filter(Boolean)
        .join(' '),
    );

    extractedPageTexts.push(pageText);
    options.onProgress?.({ phase: 'extract', currentPage: pageIndex, totalPages });
  }

  let pages = extractedPageTexts;
  let source: PdfParseSource = 'text';

  if (shouldUseOcrFallback(extractedPageTexts)) {
    const ocrPageTexts: string[] = [];

    for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
      const page = await pdfDocument.getPage(pageIndex);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const context = canvas.getContext('2d');
      if (!context) {
        ocrPageTexts.push('');
        continue;
      }

      await page.render({ canvasContext: context, canvas, viewport } as never).promise;
      const ocrText = await recognizeCanvasText(canvas, options.ocrLanguage ?? 'eng');
      ocrPageTexts.push(ocrText);

      options.onProgress?.({ phase: 'ocr', currentPage: pageIndex, totalPages });
    }

    const hadAnyExtractedText = extractedPageTexts.some((pageText) => pageText.length > 0);
    const hadAnyOcrText = ocrPageTexts.some((pageText) => pageText.length > 0);

    pages = ocrPageTexts;
    source = hadAnyExtractedText && hadAnyOcrText ? 'mixed' : 'ocr';
  }

  const text = normalizeText(pages.join(' '));
  const chunks = chunkPdfText(text, options.chunkSize ?? DEFAULT_CHUNK_SIZE);

  return {
    fileName: file.name,
    pageCount: totalPages,
    pages,
    text,
    source,
    chunks,
  };
}
