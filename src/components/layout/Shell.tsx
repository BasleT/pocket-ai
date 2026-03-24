import { FileSearch, FileText, MessageSquare, PlaySquare, Settings } from 'lucide-react';

import { IconRail } from './IconRail';
import { Panel } from './Panel';
import type { ActivePanel, RailItem } from './types';
import type { FeatureToggleId, FeatureToggles } from '../../lib/featureToggles';
import type { ChatModelId } from '../../types/chat';
import type { PageContentResult } from '../../types/page';
import type { ThemeMode } from '../../types/settings';

const RAIL_ITEMS: RailItem[] = [
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'summarize', icon: FileText, label: 'Summarize' },
  { id: 'youtube', icon: PlaySquare, label: 'YouTube' },
  { id: 'pdf', icon: FileText, label: 'PDF' },
  { id: 'ocr', icon: FileSearch, label: 'OCR' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

type ShellProps = {
  activePanel: ActivePanel;
  onSelectPanel: (panel: ActivePanel) => void;
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

export function Shell({
  activePanel,
  onSelectPanel,
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
}: ShellProps) {
  const visibleRailItems = RAIL_ITEMS.filter((item) => {
    if (item.id === 'settings') {
      return true;
    }

    if (item.id === 'chat') {
      return effectiveFeatureToggles.chatPanel;
    }

    if (item.id === 'summarize') {
      return effectiveFeatureToggles.summarizePanel;
    }

    if (item.id === 'youtube') {
      return effectiveFeatureToggles.youtubePanel;
    }

    if (item.id === 'pdf') {
      return effectiveFeatureToggles.pdfPanel;
    }

    if (item.id === 'ocr') {
      return effectiveFeatureToggles.ocrPanel;
    }

    return true;
  });

  return (
    <main className="ui-shell h-full">
      <Panel
        activePanel={activePanel}
        pageTitle={pageTitle}
        pageWarning={pageWarning}
        pageContext={pageContext}
        previousPageContext={previousPageContext}
        chatSendRequest={chatSendRequest}
        onChatSendRequestHandled={onChatSendRequestHandled}
        onAskFollowUp={onAskFollowUp}
        onNavigateToSettings={onNavigateToSettings}
        selectedModelId={selectedModelId}
        onModelChange={onModelChange}
        themeMode={themeMode}
        privateMode={privateMode}
        featureToggles={featureToggles}
        effectiveFeatureToggles={effectiveFeatureToggles}
        carryContext={carryContext}
        onThemeModeChange={onThemeModeChange}
        onPrivateModeChange={onPrivateModeChange}
        onFeatureToggleChange={onFeatureToggleChange}
      />
      <IconRail activePanel={activePanel} items={visibleRailItems} onSelect={onSelectPanel} />
    </main>
  );
}
