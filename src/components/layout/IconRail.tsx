import type { ActivePanel, RailItem } from './types';

type IconRailProps = {
  activePanel: ActivePanel;
  items: RailItem[];
  onSelect: (panel: ActivePanel) => void;
};

export function IconRail({ activePanel, items, onSelect }: IconRailProps) {
  return (
    <nav
      className="flex w-12 shrink-0 flex-col items-center border-l border-slate-200 bg-rail px-1 py-2"
      role="tablist"
      aria-label="Sidebar panel navigation"
    >
      <div className="flex w-full flex-1 flex-col items-center gap-1">
        {items.filter((item) => item.id !== 'settings').map((item) => {
          const isActive = item.id === activePanel;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              role="tab"
              aria-selected={isActive}
              className={`flex h-9 w-9 items-center justify-center rounded-lg text-base transition ${
                isActive
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-slate-400 hover:bg-white hover:text-slate-600'
              }`}
              aria-label={item.label}
              title={item.label}
            >
              <span aria-hidden="true">{item.icon}</span>
            </button>
          );
        })}
      </div>

      {items
        .filter((item) => item.id === 'settings')
        .map((item) => {
          const isActive = item.id === activePanel;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              role="tab"
              aria-selected={isActive}
              className={`mt-2 flex h-9 w-9 items-center justify-center rounded-lg text-base transition ${
                isActive
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-slate-400 hover:bg-white hover:text-slate-600'
              }`}
              aria-label={item.label}
              title={item.label}
            >
              <span aria-hidden="true">{item.icon}</span>
            </button>
          );
        })}
    </nav>
  );
}
