import { Sparkles } from 'lucide-react';

import { ChatPanel } from '../Chat/ChatPanel';
import { OcrPanel } from '../ocr/OcrPanel';
import { PdfPanel } from '../pdf/PdfPanel';
import { SettingsPanel } from '../Settings/SettingsPanel';
import { SummarizePanel } from '../summarize/SummarizePanel';
import { YouTubePanel } from '../youtube/YouTubePanel';
import { CONTENT_TYPE_META, detectContentType } from '../../lib/ai';
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
  previousPageContext: PageContentResult | null;
  chatSendRequest?: { id: string; text: string } | null;
  onChatSendRequestHandled?: (id: string) => void;
  onAskFollowUp: (summary: string) => void;
  selectedModelId: ChatModelId;
  onModelChange: (modelId: ChatModelId) => void;
  themeMode: ThemeMode;
  carryContext: boolean;
  onThemeModeChange: (theme: ThemeMode) => void;
  onCarryContextChange: (enabled: boolean) => void;
};

export function Panel({
  activePanel,
  pageTitle,
  pageWarning,
  pageContext,
  previousPageContext,
  chatSendRequest,
  onChatSendRequestHandled,
  onAskFollowUp,
  selectedModelId,
  onModelChange,
  themeMode,
  carryContext,
  onThemeModeChange,
  onCarryContextChange,
}: PanelProps) {
  const content = PANEL_CONTENT[activePanel];
  const contentType = pageContext ? detectContentType(pageContext.url, pageContext.content) : 'page';
  const contentTypeMeta = CONTENT_TYPE_META[contentType];

  return (
    <section className="ui-panel" aria-live="polite">
      <header className="ui-panel-header">
        <p className="ui-brand">Pocket AI</p>
        <div className="flex items-center gap-2 min-w-0">
          <p key={pageContext?.url ?? pageTitle} className="ui-page-title page-title-animate">{pageTitle}</p>
          {pageContext?.content ? (
            <span key={`${pageContext.url}-${contentType}`} className="ui-content-badge badge-animate" title={contentTypeMeta.label}>
              <span aria-hidden="true">{contentTypeMeta.emoji}</span>
              <span>{contentTypeMeta.label}</span>
            </span>
          ) : null}
          {pageContext?.source === 'ocr' ? (
            <span className="ui-content-badge badge-animate" title="Content extracted from screenshot OCR">
              <span aria-hidden="true">📷</span>
              <span>OCR</span>
            </span>
          ) : null}
        </div>
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
            previousPageContext={previousPageContext}
            carryContext={carryContext}
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
            carryContext={carryContext}
            onCarryContextChange={onCarryContextChange}
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
