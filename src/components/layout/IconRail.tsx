import type { ActivePanel, RailItem } from './types';

type IconRailProps = {
  activePanel: ActivePanel;
  items: RailItem[];
  onSelect: (panel: ActivePanel) => void;
};

export function IconRail({ activePanel, items, onSelect }: IconRailProps) {
  return (
    <nav className="ui-rail" role="tablist" aria-label="Sidebar panel navigation">
      <div className="ui-rail-stack">
        {items.filter((item) => item.id !== 'settings').map((item) => {
          const isActive = item.id === activePanel;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              role="tab"
              aria-selected={isActive}
              className={`ui-rail-btn ${isActive ? 'ui-rail-btn-active' : ''}`}
              aria-label={item.label}
              title={item.label}
            >
              <Icon size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {items
        .filter((item) => item.id === 'settings')
        .map((item) => {
          const isActive = item.id === activePanel;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              role="tab"
              aria-selected={isActive}
              className={`ui-rail-btn mt-auto ${isActive ? 'ui-rail-btn-active' : ''}`}
              aria-label={item.label}
              title={item.label}
            >
              <Icon size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          );
        })}
    </nav>
  );
}
