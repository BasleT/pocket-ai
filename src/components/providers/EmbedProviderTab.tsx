import type { EmbedProvider, ProviderId } from './providerConfig';

type EmbedProviderTabProps = {
  providers: EmbedProvider[];
  activeId: ProviderId;
  onSelect: (providerId: ProviderId) => void;
};

export function EmbedProviderTab({ providers, activeId, onSelect }: EmbedProviderTabProps) {
  return (
    <div
      className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800"
      role="tablist"
      aria-label="Embedded provider tabs"
    >
      {providers.map((provider) => {
        const isActive = provider.id === activeId;

        return (
          <button
            key={provider.id}
            type="button"
            onClick={() => onSelect(provider.id)}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
            aria-pressed={isActive}
            aria-label={`Switch to ${provider.name}`}
            role="tab"
            aria-selected={isActive}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${provider.colorClass}`}
              aria-hidden="true"
            />
            <span>{provider.iconLabel}</span>
            <span>{provider.name}</span>
          </button>
        );
      })}
    </div>
  );
}
