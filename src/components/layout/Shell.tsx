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
};

export function Shell({ activePanel, onSelectPanel, pageTitle, pageWarning, pageContext }: ShellProps) {
  return (
    <main className="flex h-screen w-full overflow-hidden bg-white text-text">
      <Panel
        activePanel={activePanel}
        pageTitle={pageTitle}
        pageWarning={pageWarning}
        pageContext={pageContext}
      />
      <IconRail activePanel={activePanel} items={RAIL_ITEMS} onSelect={onSelectPanel} />
    </main>
  );
}
