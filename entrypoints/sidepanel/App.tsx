import { useEffect, useMemo, useState } from 'react';

import { ChatWindow } from '../../src/components/Chat/ChatWindow';
import { EmbedProvider } from '../../src/components/providers/EmbedProvider';
import { EmbedProviderTab } from '../../src/components/providers/EmbedProviderTab';
import { ModelPicker } from '../../src/components/Toolbar/ModelPicker';
import {
  DEFAULT_PROVIDER_ID,
  EMBED_PROVIDERS,
  type ProviderId,
} from '../../src/components/providers/providerConfig';
import { GROQ_MODELS } from '../../src/lib/ai';
import { storageGet, storageSet } from '../../src/lib/storage';
import type { GroqModelId } from '../../src/types/chat';

type SidebarMode = 'embed' | 'ai';

type SessionState = {
  activeProviderId: ProviderId;
  openProviderIds: ProviderId[];
  mode: SidebarMode;
};

const OPEN_PROVIDERS_KEY = 'embedOpenProviderIds';
const ACTIVE_PROVIDER_KEY = 'embedActiveProviderId';
const SIDEBAR_MODE_KEY = 'sidebarMode';
const SELECTED_MODEL_KEY = 'aiSelectedModelId';

const DEFAULT_MODEL_ID = GROQ_MODELS[0].id;

function isGroqModelId(value: string): value is GroqModelId {
  return GROQ_MODELS.some((model) => model.id === value);
}

function isProviderId(value: string): value is ProviderId {
  return EMBED_PROVIDERS.some((provider) => provider.id === value);
}

function App() {
  const [activeProviderId, setActiveProviderId] = useState<ProviderId>(DEFAULT_PROVIDER_ID);
  const [openProviderIds, setOpenProviderIds] = useState<ProviderId[]>([DEFAULT_PROVIDER_ID]);
  const [mode, setMode] = useState<SidebarMode>('embed');
  const [selectedModelId, setSelectedModelId] = useState<GroqModelId>(DEFAULT_MODEL_ID);
  const [loadedFromSession, setLoadedFromSession] = useState(false);

  const openProviderIdSet = useMemo(() => new Set(openProviderIds), [openProviderIds]);

  useEffect(() => {
    const loadSessionState = async () => {
      const [activeProvider, openProviders, savedMode, storedModelId] = await Promise.all([
        storageGet<string>('session', ACTIVE_PROVIDER_KEY),
        storageGet<string[]>('session', OPEN_PROVIDERS_KEY),
        storageGet<string>('session', SIDEBAR_MODE_KEY),
        storageGet<string>('session', SELECTED_MODEL_KEY),
      ]);

      if (activeProvider && isProviderId(activeProvider)) {
        setActiveProviderId(activeProvider);
      }

      if (Array.isArray(openProviders)) {
        const validIds = openProviders.filter(isProviderId);
        if (validIds.length > 0) {
          setOpenProviderIds(validIds);
        }
      }

      if (savedMode === 'embed' || savedMode === 'ai') {
        setMode(savedMode);
      }

      if (storedModelId && isGroqModelId(storedModelId)) {
        setSelectedModelId(storedModelId);
      }

      setLoadedFromSession(true);
    };

    void loadSessionState();
  }, []);

  useEffect(() => {
    if (!loadedFromSession) {
      return;
    }

    void storageSet('session', ACTIVE_PROVIDER_KEY, activeProviderId);
    void storageSet('session', OPEN_PROVIDERS_KEY, openProviderIds);
    void storageSet('session', SIDEBAR_MODE_KEY, mode);
    void storageSet('session', SELECTED_MODEL_KEY, selectedModelId);
  }, [activeProviderId, loadedFromSession, mode, openProviderIds, selectedModelId]);

  const handleProviderSelect = (providerId: ProviderId) => {
    setActiveProviderId(providerId);
    setOpenProviderIds((previousIds) =>
      previousIds.includes(providerId) ? previousIds : [...previousIds, providerId],
    );
  };

  return (
    <main className="flex h-screen flex-col bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
        <h1 className="text-sm font-semibold">Pocket AI</h1>
        <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
          <button
            type="button"
            className={`rounded px-2 py-1 ${
              mode === 'embed' ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
            onClick={() => setMode('embed')}
          >
            Embed
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 ${
              mode === 'ai' ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
            onClick={() => setMode('ai')}
          >
            AI
          </button>
        </div>
      </header>

      {mode === 'embed' ? (
        <>
          <EmbedProviderTab
            providers={EMBED_PROVIDERS}
            activeId={activeProviderId}
            onSelect={handleProviderSelect}
          />
          <div className="relative min-h-0 flex-1">
            {EMBED_PROVIDERS.filter((provider) => openProviderIdSet.has(provider.id)).map((provider) => (
              <EmbedProvider
                key={provider.id}
                provider={provider}
                isActive={provider.id === activeProviderId}
              />
            ))}
          </div>
        </>
      ) : (
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-slate-200 bg-white px-3 py-2">
            <ModelPicker value={selectedModelId} onChange={setSelectedModelId} />
          </div>
          <ChatWindow modelId={selectedModelId} />
        </section>
      )}
    </main>
  );
}

export default App;
