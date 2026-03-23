import { IconRail } from './IconRail';
import { Panel } from './Panel';
import type { ActivePanel, RailItem } from './types';
import type { PageContentResult } from '../../types/page';

const RAIL_ITEMS: RailItem[] = [
  { id: 'chat', icon: '💬', label: 'Chat' },
  { id: 'summarize', icon: '📄', label: 'Summarize' },
  { id: 'youtube', icon: '🎥', label: 'YouTube' },
  { id: 'pdf', icon: '📁', label: 'PDF' },
  { id: 'ocr', icon: '🔍', label: 'OCR' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
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
}: ShellProps) {
  return (
    <main className="flex h-screen w-full overflow-hidden bg-white text-text">
      <Panel
        activePanel={activePanel}
        pageTitle={pageTitle}
        pageWarning={pageWarning}
        pageContext={pageContext}
        chatSendRequest={chatSendRequest}
        onChatSendRequestHandled={onChatSendRequestHandled}
        onAskFollowUp={onAskFollowUp}
      />
      <IconRail activePanel={activePanel} items={RAIL_ITEMS} onSelect={onSelectPanel} />
    </main>
  );
}
