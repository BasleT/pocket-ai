import { ChatPanel } from '../Chat/ChatPanel';
import type { ActivePanel } from './types';
import type { PageContentResult } from '../../types/page';

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
  pageTitle: string;
  pageWarning?: string;
  pageContext: PageContentResult | null;
};

export function Panel({ activePanel, pageTitle, pageWarning, pageContext }: PanelProps) {
  const content = PANEL_CONTENT[activePanel];

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-panel" aria-live="polite">
      <header className="border-b border-slate-200 px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Pocket AI</p>
        <h1 className="mt-1 text-base font-semibold text-slate-900">{content.title}</h1>
        <p className="mt-1 text-xs text-slate-500">{content.description}</p>
        <p className="mt-2 truncate text-[11px] text-slate-400">Current page: {pageTitle}</p>
        {pageWarning ? <p className="mt-1 text-[11px] text-amber-600">{pageWarning}</p> : null}
      </header>

      {activePanel === 'chat' ? (
        <ChatPanel pageContext={pageContext} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-700">{content.title} panel skeleton is ready.</p>
            <p className="mt-2 text-xs text-slate-500">
              This panel will be implemented in its dedicated phase.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
