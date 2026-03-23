import { OCR_LANGUAGES, type OcrLanguage } from '../../lib/extractors/ocr';
import type { OcrResult } from '../../types/ocr';

type OcrResultPanelProps = {
  result: OcrResult | null;
  selectedLanguage: OcrLanguage;
  onLanguageChange: (language: OcrLanguage) => void;
};

export function OcrResultPanel({
  result,
  selectedLanguage,
  onLanguageChange,
}: OcrResultPanelProps) {
  const canCopy = Boolean(result?.text);

  return (
    <section className="border-b border-slate-200 bg-cyan-50 px-3 py-2 dark:border-slate-700 dark:bg-cyan-950/40">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-cyan-800 dark:text-cyan-200">OCR from image</p>
        <label className="inline-flex items-center gap-1 text-[11px] text-cyan-700 dark:text-cyan-300">
          <span>Language</span>
          <select
            value={selectedLanguage}
            onChange={(event) => onLanguageChange(event.target.value as OcrLanguage)}
            className="rounded border border-cyan-300 bg-white px-1 py-0.5 text-[11px] dark:border-cyan-700 dark:bg-slate-900"
            aria-label="OCR language"
          >
            {OCR_LANGUAGES.map((language) => (
              <option key={language.id} value={language.id}>
                {language.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!result ? (
        <p className="mt-1 text-[11px] text-cyan-700 dark:text-cyan-300">
          Right-click any image and choose "Extract text from image".
        </p>
      ) : null}

      {result?.error ? <p className="mt-1 text-[11px] text-rose-700">{result.error}</p> : null}

      {result?.text ? (
        <>
          <p className="mt-1 line-clamp-3 text-[11px] text-cyan-700 dark:text-cyan-300">{result.text}</p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(result.text);
              }}
              disabled={!canCopy}
              className="rounded-md border border-cyan-300 px-2 py-1 text-[11px] text-cyan-700 disabled:opacity-60 dark:border-cyan-700 dark:text-cyan-200"
              aria-label="Copy OCR text"
            >
              Copy text
            </button>
            <p className="text-[10px] text-cyan-600 dark:text-cyan-400">Captured from {result.imageUrl}</p>
          </div>
        </>
      ) : null}
    </section>
  );
}
