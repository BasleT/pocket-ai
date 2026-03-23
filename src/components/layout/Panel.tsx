import type { ActivePanel } from './types';

type PanelContent = {
  title: string;
  description: string;
};

const PANEL_CONTENT: Record<ActivePanel, PanelContent> = {
  chat: {
    title: 'Chat',
    description: 'Always-on page-aware assistant workspace.',
  },
  summarize: {
    title: 'Summarize',
    description: 'One-click summary area for the current page.',
  },
  youtube: {
    title: 'YouTube',
    description: 'Video transcript and summary workspace.',
  },
  pdf: {
    title: 'PDF',
    description: 'Upload PDF files and chat with document content.',
  },
  ocr: {
    title: 'OCR',
    description: 'Extract text from images on the active page.',
  },
  settings: {
    title: 'Settings',
    description: 'API keys, model preferences, and appearance controls.',
  },
};

type PanelProps = {
  activePanel: ActivePanel;
};

export function Panel({ activePanel }: PanelProps) {
  const content = PANEL_CONTENT[activePanel];

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-panel" aria-live="polite">
      <header className="border-b border-slate-200 px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Pocket AI</p>
        <h1 className="mt-1 text-base font-semibold text-slate-900">{content.title}</h1>
        <p className="mt-1 text-xs text-slate-500">{content.description}</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-700">{content.title} panel skeleton is ready.</p>
          <p className="mt-2 text-xs text-slate-500">
            Phase 0 layout only: feature logic and AI behavior come in later phases.
          </p>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white px-3 py-3">
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-600"
            aria-label="Model selector placeholder"
            defaultValue="llama-3.3-70b-versatile"
          >
            <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
          </select>
          <input
            type="text"
            className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700"
            placeholder="Ask about this page..."
            aria-label="Chat input placeholder"
            readOnly
          />
        </div>
      </footer>
    </section>
  );
}
