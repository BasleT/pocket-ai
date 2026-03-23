import { useState } from 'react';

import { EMBED_PROVIDERS, type ProviderId } from '../providers/providerConfig';
import type {
  ApiProviderId,
  ApiProviderSecrets,
  ConnectionTestStatus,
  EmbedProviderToggles,
} from '../../types/settings';

type SettingsPanelProps = {
  embedProviderToggles: EmbedProviderToggles;
  apiKeyConfigured: Record<ApiProviderId, boolean>;
  connectionStatuses: Partial<Record<ApiProviderId, ConnectionTestStatus>>;
  onProviderToggle: (providerId: ProviderId, enabled: boolean) => void;
  onSaveApiKey: (provider: ApiProviderId, value: string) => Promise<void>;
  onClearApiKey: (provider: ApiProviderId) => Promise<void>;
  onTestConnection: (provider: ApiProviderId) => Promise<void>;
};

type TabId = 'providers' | 'keys' | 'connections';

const API_PROVIDER_LABELS: Record<ApiProviderId, string> = {
  groq: 'Groq',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google AI Studio',
};

const API_PROVIDER_ORDER: ApiProviderId[] = ['groq', 'openai', 'anthropic', 'google'];

export function SettingsPanel({
  embedProviderToggles,
  apiKeyConfigured,
  connectionStatuses,
  onProviderToggle,
  onSaveApiKey,
  onClearApiKey,
  onTestConnection,
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('providers');
  const [draftKeys, setDraftKeys] = useState<Partial<ApiProviderSecrets>>({});

  return (
    <section className="border-b border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold text-slate-800">Settings</p>

      <div className="mt-2 inline-flex rounded-md border border-slate-200 p-0.5 text-xs">
        {([
          ['providers', 'Providers'],
          ['keys', 'API Keys'],
          ['connections', 'Connections'],
        ] as const).map(([tabId, label]) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setActiveTab(tabId)}
            className={`rounded px-2 py-1 ${
              activeTab === tabId ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'providers' ? (
        <div className="mt-2 space-y-1">
          {EMBED_PROVIDERS.map((provider) => (
            <label key={provider.id} className="flex items-center justify-between text-xs text-slate-700">
              <span>{provider.name}</span>
              <input
                type="checkbox"
                checked={embedProviderToggles[provider.id] ?? true}
                onChange={(event) => onProviderToggle(provider.id, event.target.checked)}
              />
            </label>
          ))}
        </div>
      ) : null}

      {activeTab === 'keys' ? (
        <div className="mt-2 space-y-2">
          {API_PROVIDER_ORDER.map((provider) => {
            const field = `${provider}ApiKey` as keyof ApiProviderSecrets;
            const draftValue = draftKeys[field] ?? '';

            return (
              <div key={provider} className="rounded border border-slate-200 p-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-700">{API_PROVIDER_LABELS[provider]}</p>
                  <p className="text-[11px] text-slate-500">
                    {apiKeyConfigured[provider] ? 'Configured' : 'Not configured'}
                  </p>
                </div>
                <input
                  type="password"
                  value={draftValue}
                  onChange={(event) =>
                    setDraftKeys((previous) => ({
                      ...previous,
                      [field]: event.target.value,
                    }))
                  }
                  placeholder={`Enter ${API_PROVIDER_LABELS[provider]} key`}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void onSaveApiKey(provider, draftValue)}
                    className="rounded bg-slate-900 px-2 py-1 text-xs text-white"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => void onClearApiKey(provider)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                  >
                    Clear
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {activeTab === 'connections' ? (
        <div className="mt-2 space-y-2">
          {API_PROVIDER_ORDER.map((provider) => (
            <div key={provider} className="rounded border border-slate-200 p-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-700">{API_PROVIDER_LABELS[provider]}</p>
                <button
                  type="button"
                  onClick={() => void onTestConnection(provider)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
                >
                  Test connection
                </button>
              </div>
              {connectionStatuses[provider] ? (
                <p
                  className={`mt-1 text-[11px] ${
                    connectionStatuses[provider]?.ok ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {connectionStatuses[provider]?.ok ? '✅' : '❌'} {connectionStatuses[provider]?.message}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
