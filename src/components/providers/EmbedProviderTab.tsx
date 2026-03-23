import type { EmbedProvider, ProviderId } from './providerConfig';

type EmbedProviderTabProps = {
  providers: EmbedProvider[];
  activeId: ProviderId;
  onSelect: (providerId: ProviderId) => void;
};

export function EmbedProviderTab({ providers, activeId, onSelect }: EmbedProviderTabProps) {
  return (
    <div className="embed-tabbar" role="tablist" aria-label="Embedded provider tabs">
      {providers.map((provider) => {
        const isActive = provider.id === activeId;

        return (
          <button
            key={provider.id}
            type="button"
            onClick={() => onSelect(provider.id)}
            className={`embed-tab ${isActive ? 'embed-tab-active' : ''}`}
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
