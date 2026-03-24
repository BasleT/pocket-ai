import { Sparkles } from 'lucide-react';

import { ChatPanel } from '../Chat/ChatPanel';
import { OcrPanel } from '../ocr/OcrPanel';
import { PdfPanel } from '../pdf/PdfPanel';
import { SettingsPanel } from '../Settings/SettingsPanel';
import { SummarizePanel } from '../summarize/SummarizePanel';
import { YouTubePanel } from '../youtube/YouTubePanel';
import { CONTENT_TYPE_META, detectContentType } from '../../lib/ai';
import type { FeatureToggleId, FeatureToggles } from '../../lib/featureToggles';
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
  onNavigateToSettings: () => void;
  selectedModelId: ChatModelId;
  onModelChange: (modelId: ChatModelId) => void;
  themeMode: ThemeMode;
  privateMode: boolean;
  featureToggles: FeatureToggles;
  effectiveFeatureToggles: FeatureToggles;
  carryContext: boolean;
  onThemeModeChange: (theme: ThemeMode) => void;
  onPrivateModeChange: (enabled: boolean) => void;
  onFeatureToggleChange: (toggleId: FeatureToggleId, enabled: boolean) => void;
};

function ExtractionBadge({ source }: { source?: PageContentResult['source'] }) {
  if (!source || source === 'readability') {
    return null;
  }

  const config = {
    fallback: { label: 'Limited context', color: 'var(--text-muted)' },
    body: { label: 'Body text only', color: '#f59e0b' },
    dom: { label: 'DOM fallback', color: '#f59e0b' },
    ocr: { label: 'OCR extracted', color: '#3b82f6' },
    unsupported: { label: 'No page context', color: '#ef4444' },
  }[source] ?? { label: source, color: 'var(--text-muted)' };

  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px]"
      style={{ color: config.color, background: 'var(--bg-overlay)' }}
      title={config.label}
    >
      {config.label}
    </span>
  );
}

export function Panel({
  activePanel,
  pageTitle,
  pageWarning,
  pageContext,
  previousPageContext,
  chatSendRequest,
  onChatSendRequestHandled,
  onAskFollowUp,
  onNavigateToSettings,
  selectedModelId,
  onModelChange,
  themeMode,
  privateMode,
  featureToggles,
  effectiveFeatureToggles,
  carryContext,
  onThemeModeChange,
  onPrivateModeChange,
  onFeatureToggleChange,
}: PanelProps) {
  const content = PANEL_CONTENT[activePanel];
  const contentType = pageContext ? detectContentType(pageContext.url, pageContext.content) : 'page';
  const contentTypeMeta = CONTENT_TYPE_META[contentType];

  return (
    <section className="ui-panel" aria-live="polite">
      <header className="ui-panel-header">
        <p className="ui-brand shrink-0">Pocket AI</p>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-hidden pl-3">
          <p
            key={pageContext?.url ?? pageTitle}
            className="ui-page-title page-title-animate min-w-0 truncate"
          >
            {pageTitle}
          </p>

          {pageContext?.source && pageContext.source !== 'readability' ? (
            <ExtractionBadge source={pageContext.source} />
          ) : pageContext?.content ? (
            <span
              key={`${pageContext.url}-${contentType}`}
              className="ui-content-badge badge-animate shrink-0"
              title={contentTypeMeta.label}
            >
              <span aria-hidden="true">{contentTypeMeta.emoji}</span>
            </span>
          ) : null}
        </div>
      </header>

      {pageWarning && pageWarning !== pageContext?.warning ? (
        <div className="px-4 py-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          {pageWarning}
        </div>
      ) : null}

      <div key={activePanel} className="ui-panel-body panel-animate h-full">
        {activePanel === 'chat' ? (
          <ChatPanel
            pageContext={pageContext}
            previousPageContext={previousPageContext}
            carryContext={carryContext}
            sendRequest={chatSendRequest}
            onSendRequestHandled={onChatSendRequestHandled}
            modelId={selectedModelId}
            onModelChange={onModelChange}
            onNavigateToSettings={onNavigateToSettings}
          />
        ) : activePanel === 'summarize' ? (
          <SummarizePanel pageContext={pageContext} onAskFollowUp={onAskFollowUp} />
        ) : activePanel === 'youtube' ? (
          <YouTubePanel
            activePageUrl={pageContext?.url ?? ''}
            enabled={effectiveFeatureToggles.youtubeAutoFetch}
            onAskAboutVideo={onAskFollowUp}
          />
        ) : activePanel === 'pdf' ? (
          <PdfPanel onAskAboutPdf={onAskFollowUp} />
        ) : activePanel === 'ocr' ? (
          <OcrPanel onSendToChat={onAskFollowUp} />
        ) : activePanel === 'settings' ? (
          <SettingsPanel
            selectedModelId={selectedModelId}
            onModelChange={onModelChange}
            themeMode={themeMode}
            privateMode={privateMode}
            featureToggles={featureToggles}
            effectiveFeatureToggles={effectiveFeatureToggles}
            onThemeModeChange={onThemeModeChange}
            onPrivateModeChange={onPrivateModeChange}
            onFeatureToggleChange={onFeatureToggleChange}
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
