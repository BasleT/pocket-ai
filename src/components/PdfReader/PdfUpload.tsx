import { useRef } from 'react';

import type { PdfParseProgress } from '../../types/pdf';

type PdfUploadProps = {
  isParsing: boolean;
  progress: PdfParseProgress | null;
  pageCount: number | null;
  onFileSelected: (file: File) => void;
};

function toProgressPercent(progress: PdfParseProgress | null): number {
  if (!progress || progress.totalPages <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((progress.currentPage / progress.totalPages) * 100));
}

export function PdfUpload({ isParsing, progress, pageCount, onFileSelected }: PdfUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const progressPercent = toProgressPercent(progress);

  const handleFile = (file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return;
    }

    onFileSelected(file);
  };

  return (
    <section className="border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
      <div
        className="rounded-md border border-dashed border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-900"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleFile(event.dataTransfer.files.item(0));
        }}
      >
        <p className="text-xs font-medium text-slate-700 dark:text-slate-200">Upload PDF for chat context</p>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Drop a file here or choose one from disk.</p>
        <div className="mt-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing}
            className="rounded-md bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-60"
            aria-label="Choose PDF file"
          >
            {isParsing ? 'Parsing...' : 'Choose PDF'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.item(0) ?? null)}
            aria-label="PDF file input"
          />
        </div>
      </div>

      {isParsing && progress ? (
        <div className="mt-2 rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-[11px] text-slate-600 dark:text-slate-300">
            {progress.phase === 'extract' ? 'Extracting text' : 'Running OCR'} page {progress.currentPage} of{' '}
            {progress.totalPages}
          </p>
          <div className="mt-1 h-1.5 rounded bg-slate-200">
            <div className="h-1.5 rounded bg-slate-700" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      ) : null}

      {pageCount ? <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">Parsed page count: {pageCount}</p> : null}
    </section>
  );
}
