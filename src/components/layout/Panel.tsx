import { Sparkles } from 'lucide-react';

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
    <section className="ui-panel" aria-live="polite">
      <header className="ui-panel-header">
        <p className="ui-brand">Pocket AI</p>
        <p className="ui-page-title">{pageTitle}</p>
      </header>

      {pageWarning ? (
        <div className="px-4 py-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          {pageWarning}
        </div>
      ) : null}

      <div key={activePanel} className="ui-panel-body panel-animate">
        {activePanel === 'chat' ? (
          <ChatPanel
            pageContext={pageContext}
            sendRequest={chatSendRequest}
            onSendRequestHandled={onChatSendRequestHandled}
            modelId={selectedModelId}
            onModelChange={onModelChange}
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
          <div className="ui-empty">
            <Sparkles size={32} className="ui-muted" />
            <p className="text-sm">{content.title} panel is ready.</p>
            <p className="text-xs ui-muted">{content.description}</p>
          </div>
        )}
      </div>
    </section>
  );
}
