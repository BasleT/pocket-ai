import { IconRail } from './IconRail';
import { Panel } from './Panel';
import type { ActivePanel, RailItem } from './types';

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
};

export function Shell({ activePanel, onSelectPanel }: ShellProps) {
  return (
    <main className="flex h-screen w-full overflow-hidden bg-white text-text">
      <Panel activePanel={activePanel} />
      <IconRail activePanel={activePanel} items={RAIL_ITEMS} onSelect={onSelectPanel} />
    </main>
  );
}
