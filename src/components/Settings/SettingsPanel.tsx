import { useEffect, useState } from 'react';

import { Moon, Sun } from 'lucide-react';

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
  carryContext: boolean;
  onCarryContextChange: (enabled: boolean) => void;
};

const PROVIDERS: ApiProviderId[] = ['groq', 'openai', 'anthropic', 'google'];

export function SettingsPanel({
  selectedModelId,
  onModelChange,
  themeMode,
  onThemeModeChange,
  carryContext,
  onCarryContextChange,
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
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        Settings
      </h2>

      <div className="ui-card mt-3 p-3">
        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Model
        </label>
        <select
          className="ui-input mt-1 h-10 w-full"
          value={selectedModelId}
          onChange={(event) => onModelChange(event.target.value as ChatModelId)}
        >
          {CHAT_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>

        <div className="mt-3">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Dark mode
          </p>
          <button
            type="button"
            onClick={() => {
              const nextTheme: ThemeMode = themeMode === 'dark' ? 'light' : 'dark';
              onThemeModeChange(nextTheme);
              void storageSet('local', THEME_KEY, nextTheme);
            }}
            className="ui-btn ui-btn-ghost mt-2 inline-flex items-center gap-2"
          >
            {themeMode === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
            {themeMode === 'dark' ? 'Dark enabled' : 'Light enabled'}
          </button>
        </div>

        <div className="mt-3">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Carry context between tabs
          </p>
          <button
            type="button"
            onClick={() => onCarryContextChange(!carryContext)}
            className="ui-btn ui-btn-ghost mt-2"
          >
            {carryContext ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {PROVIDERS.map((provider) => (
          <div key={provider} className="ui-card p-3">
            <p className="text-xs font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
              {provider}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
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
              className="ui-input mt-2 h-10 w-full"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void saveKey(provider);
                }}
                className="ui-btn ui-btn-accent"
              >
                Save key
              </button>
              <button
                type="button"
                onClick={() => {
                  void clearKey(provider);
                }}
                className="ui-btn ui-btn-ghost"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  void testConnection(provider);
                }}
                className="ui-btn ui-btn-ghost"
              >
                Test
              </button>
            </div>
            {connectionStatuses[provider] ? (
              <p
                className="mt-2 text-[11px]"
                style={{ color: connectionStatuses[provider]?.ok ? '#34d399' : '#fb7185' }}
              >
                {connectionStatuses[provider]?.ok ? 'Connected:' : 'Failed:'} {connectionStatuses[provider]?.message}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
