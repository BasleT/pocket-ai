import { useMemo, useState } from 'react';

import { parsePdfFile } from '../../lib/extractors/pdf';
import type { PdfParseProgress, PdfParseResult } from '../../types/pdf';

type PdfPanelProps = {
  onAskAboutPdf: (text: string) => void;
};

export function PdfPanel({ onAskAboutPdf }: PdfPanelProps) {
  const [parsedPdf, setParsedPdf] = useState<PdfParseResult | null>(null);
  const [progress, setProgress] = useState<PdfParseProgress | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progressText = useMemo(() => {
    if (!progress) {
      return null;
    }

    return `${progress.phase === 'extract' ? 'Extracting' : 'Running OCR'} page ${progress.currentPage}/${progress.totalPages}`;
  }, [progress]);

  const handleFile = async (file: File) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file.');
      return;
    }

    setIsParsing(true);
    setError(null);
    setParsedPdf(null);
    setProgress(null);

    try {
      const result = await parsePdfFile(file, {
        onProgress: (nextProgress) => setProgress(nextProgress),
      });

      setParsedPdf(result);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to parse PDF.');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col p-4">
      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white">
        <span>Upload PDF</span>
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }

            void handleFile(file);
          }}
        />
      </label>

      {isParsing ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-600">{progressText ?? 'Parsing PDF...'}</p>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}

      {parsedPdf ? (
        <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">{parsedPdf.fileName}</p>
          <p className="mt-1 text-xs text-slate-500">
            {parsedPdf.pageCount} pages · {parsedPdf.source} extraction
          </p>

          <button
            type="button"
            onClick={() =>
              onAskAboutPdf(
                `Use this PDF context for follow-up questions:\n\n${parsedPdf.text.slice(0, 12000)}`,
              )
            }
            className="mt-3 w-fit rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
          >
            Ask about this PDF
          </button>

          <article className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap">
            {parsedPdf.text || 'No extractable text found in this PDF.'}
          </article>
        </div>
      ) : null}
    </section>
  );
}
