import { useState } from 'react';

import { EMBED_PROVIDERS, type ProviderId } from '../providers/providerConfig';
import type {
  ApiProviderId,
  ApiProviderSecrets,
  ConnectionTestStatus,
  EmbedProviderToggles,
  ThemeMode,
} from '../../types/settings';

type SettingsPanelProps = {
  embedProviderToggles: EmbedProviderToggles;
  apiKeyConfigured: Record<ApiProviderId, boolean>;
  connectionStatuses: Partial<Record<ApiProviderId, ConnectionTestStatus>>;
  themeMode: ThemeMode;
  onProviderToggle: (providerId: ProviderId, enabled: boolean) => void;
  onThemeModeChange: (mode: ThemeMode) => void;
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
  themeMode,
  onProviderToggle,
  onThemeModeChange,
  onSaveApiKey,
  onClearApiKey,
  onTestConnection,
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('providers');
  const [draftKeys, setDraftKeys] = useState<Partial<ApiProviderSecrets>>({});

  return (
    <section className="border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Settings</p>

      <div className="mt-2 inline-flex rounded-md border border-slate-200 p-0.5 text-xs dark:border-slate-700">
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
              activeTab === tabId
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-300'
            }`}
            aria-label={`Show ${label} settings`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'providers' ? (
        <div className="mt-2 space-y-1">
          <label className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-200">
            <span>Theme</span>
            <select
              value={themeMode}
              onChange={(event) => onThemeModeChange(event.target.value as ThemeMode)}
              className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
              aria-label="Choose theme mode"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          {EMBED_PROVIDERS.map((provider) => (
            <label
              key={provider.id}
              className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-200"
            >
              <span>{provider.name}</span>
              <input
                type="checkbox"
                checked={embedProviderToggles[provider.id] ?? true}
                onChange={(event) => onProviderToggle(provider.id, event.target.checked)}
                aria-label={`Toggle ${provider.name} provider`}
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
              <div key={provider} className="rounded border border-slate-200 p-2 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-100">{API_PROVIDER_LABELS[provider]}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
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
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  aria-label={`${API_PROVIDER_LABELS[provider]} API key`}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void onSaveApiKey(provider, draftValue)}
                    className="rounded bg-slate-900 px-2 py-1 text-xs text-white"
                    aria-label={`Save ${API_PROVIDER_LABELS[provider]} API key`}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => void onClearApiKey(provider)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:text-slate-300"
                    aria-label={`Clear ${API_PROVIDER_LABELS[provider]} API key`}
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
            <div key={provider} className="rounded border border-slate-200 p-2 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-100">{API_PROVIDER_LABELS[provider]}</p>
                <button
                  type="button"
                  onClick={() => void onTestConnection(provider)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:text-slate-300"
                  aria-label={`Test ${API_PROVIDER_LABELS[provider]} connection`}
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
