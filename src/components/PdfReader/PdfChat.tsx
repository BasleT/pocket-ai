import type { PdfParseResult } from '../../types/pdf';

type PdfChatProps = {
  parsedPdf: PdfParseResult | null;
  errorMessage: string | null;
  onClear: () => void;
};

export function PdfChat({ parsedPdf, errorMessage, onClear }: PdfChatProps) {
  if (!parsedPdf && !errorMessage) {
    return null;
  }

  return (
    <section className="border-b border-slate-200 bg-violet-50 px-3 py-2">
      {parsedPdf ? (
        <>
          <p className="text-xs font-medium text-violet-800">PDF context active</p>
          <p className="mt-1 text-[11px] text-violet-700">File: {parsedPdf.fileName}</p>
          <p className="text-[11px] text-violet-700">
            Source: {parsedPdf.source} · Pages: {parsedPdf.pageCount} · Chunks: {parsedPdf.chunks.length}
          </p>
          <button
            type="button"
            onClick={onClear}
            className="mt-2 rounded-md border border-violet-300 px-2 py-1 text-xs text-violet-700"
          >
            Clear PDF context
          </button>
        </>
      ) : null}

      {errorMessage ? <p className="text-[11px] text-rose-700">{errorMessage}</p> : null}
    </section>
  );
}
