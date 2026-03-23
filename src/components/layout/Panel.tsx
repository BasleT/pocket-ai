import { ChatPanel } from '../Chat/ChatPanel';
import { OcrPanel } from '../ocr/OcrPanel';
import { PdfPanel } from '../pdf/PdfPanel';
import { SettingsPanel } from '../Settings/SettingsPanel';
import { SummarizePanel } from '../summarize/SummarizePanel';
import { YouTubePanel } from '../youtube/YouTubePanel';
import type { ActivePanel } from './types';
import type { ChatModelId } from '../../types/chat';
import type { PageContentResult } from '../../types/page';
import type { ThemeMode } from '../../types/settings';

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
  chatSendRequest?: { id: string; text: string } | null;
  onChatSendRequestHandled?: (id: string) => void;
  onAskFollowUp: (summary: string) => void;
  selectedModelId: ChatModelId;
  onModelChange: (modelId: ChatModelId) => void;
  themeMode: ThemeMode;
  onThemeModeChange: (theme: ThemeMode) => void;
};

export function Panel({
  activePanel,
  pageTitle,
  pageWarning,
  pageContext,
  chatSendRequest,
  onChatSendRequestHandled,
  onAskFollowUp,
  selectedModelId,
  onModelChange,
  themeMode,
  onThemeModeChange,
}: PanelProps) {
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

      <div key={activePanel} className="panel-animate min-h-0 flex-1">
        {activePanel === 'chat' ? (
          <ChatPanel
            pageContext={pageContext}
            sendRequest={chatSendRequest}
            onSendRequestHandled={onChatSendRequestHandled}
            modelId={selectedModelId}
          />
        ) : activePanel === 'summarize' ? (
          <SummarizePanel pageContext={pageContext} onAskFollowUp={onAskFollowUp} />
        ) : activePanel === 'youtube' ? (
          <YouTubePanel onAskAboutVideo={onAskFollowUp} />
        ) : activePanel === 'pdf' ? (
          <PdfPanel onAskAboutPdf={onAskFollowUp} />
        ) : activePanel === 'ocr' ? (
          <OcrPanel onSendToChat={onAskFollowUp} />
        ) : activePanel === 'settings' ? (
          <SettingsPanel
            selectedModelId={selectedModelId}
            onModelChange={onModelChange}
            themeMode={themeMode}
            onThemeModeChange={onThemeModeChange}
          />
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
      </div>
    </section>
  );
}
