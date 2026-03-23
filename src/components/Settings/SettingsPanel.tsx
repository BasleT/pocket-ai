import { useEffect, useState } from 'react';

import { CHAT_MODELS } from '../../lib/ai';
import { storageGetSecret, storageRemoveSecret, storageSet, storageSetSecret } from '../../lib/storage';
import type { ChatModelId } from '../../types/chat';
import {
  API_KEY_FIELD_MAP,
  type ApiProviderId,
  type ConnectionTestStatus,
  type TestConnectionResponse,
  type ThemeMode,
} from '../../types/settings';

const THEME_KEY = 'settings.themeMode';

type SettingsPanelProps = {
  selectedModelId: ChatModelId;
  onModelChange: (modelId: ChatModelId) => void;
  themeMode: ThemeMode;
  onThemeModeChange: (theme: ThemeMode) => void;
};

const PROVIDERS: ApiProviderId[] = ['groq', 'openai', 'anthropic', 'google'];

export function SettingsPanel({
  selectedModelId,
  onModelChange,
  themeMode,
  onThemeModeChange,
}: SettingsPanelProps) {
  const [apiConfigured, setApiConfigured] = useState<Record<ApiProviderId, boolean>>({
    groq: false,
    openai: false,
    anthropic: false,
    google: false,
  });
  const [apiInputs, setApiInputs] = useState<Record<ApiProviderId, string>>({
    groq: '',
    openai: '',
    anthropic: '',
    google: '',
  });
  const [connectionStatuses, setConnectionStatuses] = useState<
    Partial<Record<ApiProviderId, ConnectionTestStatus>>
  >({});

  useEffect(() => {
    const load = async () => {
      const [groqKey, openaiKey, anthropicKey, googleKey] = await Promise.all([
        storageGetSecret(API_KEY_FIELD_MAP.groq),
        storageGetSecret(API_KEY_FIELD_MAP.openai),
        storageGetSecret(API_KEY_FIELD_MAP.anthropic),
        storageGetSecret(API_KEY_FIELD_MAP.google),
      ]);

      setApiConfigured({
        groq: Boolean(groqKey),
        openai: Boolean(openaiKey),
        anthropic: Boolean(anthropicKey),
        google: Boolean(googleKey),
      });
    };

    void load();
  }, []);

  const saveKey = async (provider: ApiProviderId) => {
    const value = apiInputs[provider].trim();
    if (!value) {
      return;
    }

    await storageSetSecret(API_KEY_FIELD_MAP[provider], value);
    setApiConfigured((previous) => ({ ...previous, [provider]: true }));
    setApiInputs((previous) => ({ ...previous, [provider]: '' }));
  };

  const clearKey = async (provider: ApiProviderId) => {
    await storageRemoveSecret(API_KEY_FIELD_MAP[provider]);
    setApiConfigured((previous) => ({ ...previous, [provider]: false }));
  };

  const testConnection = async (provider: ApiProviderId) => {
    const response = (await chrome.runtime.sendMessage({
      type: 'TEST_PROVIDER_CONNECTION',
      provider,
    })) as TestConnectionResponse;

    setConnectionStatuses((previous) => ({
      ...previous,
      [provider]: {
        provider,
        ok: response.ok,
        message: response.message,
      },
    }));
  };

  return (
    <section className="min-h-0 flex-1 overflow-y-auto p-4">
      <h2 className="text-sm font-semibold text-slate-900">Settings</h2>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <label className="text-xs text-slate-500">Model</label>
        <select
          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm"
          value={selectedModelId}
          onChange={(event) => onModelChange(event.target.value as ChatModelId)}
        >
          {CHAT_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>

        <label className="mt-3 block text-xs text-slate-500">Theme</label>
        <select
          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm"
          value={themeMode}
          onChange={(event) => {
            const nextTheme = event.target.value as ThemeMode;
            onThemeModeChange(nextTheme);
            void storageSet('local', THEME_KEY, nextTheme);
          }}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>

      <div className="mt-3 space-y-2">
        {PROVIDERS.map((provider) => (
          <div key={provider} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-medium text-slate-700 capitalize">{provider}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {apiConfigured[provider] ? 'API key saved' : 'API key not configured'}
            </p>
            <input
              type="password"
              value={apiInputs[provider]}
              onChange={(event) =>
                setApiInputs((previous) => ({
                  ...previous,
                  [provider]: event.target.value,
                }))
              }
              placeholder={`Enter ${provider} API key`}
              className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void saveKey(provider);
                }}
                className="rounded-lg bg-accent px-3 py-2 text-xs text-white"
              >
                Save key
              </button>
              <button
                type="button"
                onClick={() => {
                  void clearKey(provider);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  void testConnection(provider);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
              >
                Test
              </button>
            </div>
            {connectionStatuses[provider] ? (
              <p className={`mt-2 text-[11px] ${connectionStatuses[provider]?.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                {connectionStatuses[provider]?.ok ? 'Connected:' : 'Failed:'} {connectionStatuses[provider]?.message}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
