import { FileSearch, FileText, MessageSquare, PlaySquare, Settings } from 'lucide-react';

import { IconRail } from './IconRail';
import { Panel } from './Panel';
import type { ActivePanel, RailItem } from './types';
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
  chatSendRequest?: { id: string; text: string } | null;
  onChatSendRequestHandled?: (id: string) => void;
  onAskFollowUp: (summary: string) => void;
  selectedModelId: ChatModelId;
  onModelChange: (modelId: ChatModelId) => void;
  themeMode: ThemeMode;
  onThemeModeChange: (theme: ThemeMode) => void;
};

export function Shell({
  activePanel,
  onSelectPanel,
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
}: ShellProps) {
  return (
    <main className="ui-shell">
      <Panel
        activePanel={activePanel}
        pageTitle={pageTitle}
        pageWarning={pageWarning}
        pageContext={pageContext}
        chatSendRequest={chatSendRequest}
        onChatSendRequestHandled={onChatSendRequestHandled}
        onAskFollowUp={onAskFollowUp}
        selectedModelId={selectedModelId}
        onModelChange={onModelChange}
        themeMode={themeMode}
        onThemeModeChange={onThemeModeChange}
      />
      <IconRail activePanel={activePanel} items={RAIL_ITEMS} onSelect={onSelectPanel} />
    </main>
  );
}
