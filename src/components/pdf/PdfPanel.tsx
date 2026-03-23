import { useMemo, useState } from 'react';

import { FileText } from 'lucide-react';

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
      <label className="ui-btn ui-btn-accent inline-flex w-fit items-center gap-2">
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
        <div className="ui-card mt-3 p-4">
          <p className="text-xs ui-subtle">{progressText ?? 'Parsing PDF...'}</p>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs" style={{ color: '#fb7185' }}>{error}</p> : null}

      {!parsedPdf && !isParsing ? (
        <div className="ui-empty mt-3">
          <FileText size={32} className="ui-muted" />
          <p className="text-xs ui-subtle">Upload a PDF to parse it and chat with the extracted content.</p>
        </div>
      ) : null}

      {parsedPdf ? (
        <div className="ui-card mt-3 flex min-h-0 flex-1 flex-col p-4">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {parsedPdf.fileName}
          </p>
          <p className="mt-1 text-xs ui-subtle">
            {parsedPdf.pageCount} pages · {parsedPdf.source} extraction
          </p>

          <button
            type="button"
            onClick={() =>
              onAskAboutPdf(
                `Use this PDF context for follow-up questions:\n\n${parsedPdf.text.slice(0, 12000)}`,
              )
            }
            className="ui-btn ui-btn-ghost mt-3 w-fit"
          >
            Ask about this PDF
          </button>

          <article className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg p-3 text-xs whitespace-pre-wrap" style={{ background: 'var(--bg-overlay)', color: 'var(--text-primary)' }}>
            {parsedPdf.text || 'No extractable text found in this PDF.'}
          </article>
        </div>
      ) : null}
    </section>
  );
}
