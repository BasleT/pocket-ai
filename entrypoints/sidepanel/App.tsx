import { useEffect, useMemo, useState } from 'react';

import { EmbedProvider } from '../../src/components/providers/EmbedProvider';
import { EmbedProviderTab } from '../../src/components/providers/EmbedProviderTab';
import {
  DEFAULT_PROVIDER_ID,
  EMBED_PROVIDERS,
  type ProviderId,
} from '../../src/components/providers/providerConfig';
import { storageGet, storageSet } from '../../src/lib/storage';

type SidebarMode = 'embed' | 'ai';

type SessionState = {
  activeProviderId: ProviderId;
  openProviderIds: ProviderId[];
  mode: SidebarMode;
};

const OPEN_PROVIDERS_KEY = 'embedOpenProviderIds';
const ACTIVE_PROVIDER_KEY = 'embedActiveProviderId';
const SIDEBAR_MODE_KEY = 'sidebarMode';

function isProviderId(value: string): value is ProviderId {
  return EMBED_PROVIDERS.some((provider) => provider.id === value);
}

function App() {
  const [activeProviderId, setActiveProviderId] = useState<ProviderId>(DEFAULT_PROVIDER_ID);
  const [openProviderIds, setOpenProviderIds] = useState<ProviderId[]>([DEFAULT_PROVIDER_ID]);
  const [mode, setMode] = useState<SidebarMode>('embed');
  const [loadedFromSession, setLoadedFromSession] = useState(false);

  const openProviderIdSet = useMemo(() => new Set(openProviderIds), [openProviderIds]);

  useEffect(() => {
    const loadSessionState = async () => {
      const [activeProvider, openProviders, savedMode] = await Promise.all([
        storageGet<string>('session', ACTIVE_PROVIDER_KEY),
        storageGet<string[]>('session', OPEN_PROVIDERS_KEY),
        storageGet<string>('session', SIDEBAR_MODE_KEY),
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
  }, [activeProviderId, loadedFromSession, mode, openProviderIds]);

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
        <section className="flex h-full items-center justify-center p-5">
          <div className="max-w-xs rounded-lg border border-slate-200 bg-white p-4 text-center">
            <p className="text-sm font-medium text-slate-900">API mode arrives in Phase 2</p>
            <p className="mt-1 text-xs text-slate-600">
              Switch back to Embed mode to use your existing provider logins now.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
