import type { ProviderId } from '../components/providers/providerConfig';
import type { OcrLanguage } from '../lib/extractors/ocr';

export type ApiProviderId = 'groq' | 'openai' | 'anthropic' | 'google';

export type ApiProviderSecrets = {
  groqApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  googleApiKey?: string;
};

export type EmbedProviderToggles = Record<ProviderId, boolean>;

export type ConnectionTestStatus = {
  provider: ApiProviderId;
  ok: boolean;
  message: string;
};

export type TestConnectionMessage = {
  type: 'TEST_PROVIDER_CONNECTION';
  provider: ApiProviderId;
};

export type TestConnectionResponse =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

export type AppSettings = {
  embedProviders: EmbedProviderToggles;
  ocrLanguage: OcrLanguage;
};

export const EMBED_PROVIDER_TOGGLE_STORAGE_KEY = 'settings.embedProviders';

export const API_KEY_FIELD_MAP: Record<ApiProviderId, keyof ApiProviderSecrets> = {
  groq: 'groqApiKey',
  openai: 'openaiApiKey',
  anthropic: 'anthropicApiKey',
  google: 'googleApiKey',
};
