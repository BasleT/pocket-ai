import { useEffect, useMemo, useState } from 'react';

import { ChatWindow } from '../../src/components/Chat/ChatWindow';
import { EmbedProvider } from '../../src/components/providers/EmbedProvider';
import { EmbedProviderTab } from '../../src/components/providers/EmbedProviderTab';
import { ContextBar } from '../../src/components/Toolbar/ContextBar';
import { ModelPicker } from '../../src/components/Toolbar/ModelPicker';
import {
  DEFAULT_PROVIDER_ID,
  EMBED_PROVIDERS,
  type ProviderId,
} from '../../src/components/providers/providerConfig';
import { GROQ_MODELS } from '../../src/lib/ai';
import { storageGet, storageSet } from '../../src/lib/storage';
import type { GroqModelId } from '../../src/types/chat';
import type { GetPageContentResponse, PageContentResult } from '../../src/types/page';

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

function buildPageSummarizePrompt(page: PageContentResult): string {
  const selectionBlock = page.selection
    ? `\n\nSelected text:\n${page.selection}`
    : '\n\nSelected text: (none)';

  return [
    'Summarize this page and highlight key points in concise bullet points.',
    `Title: ${page.title}`,
    `URL: ${page.url}`,
    `Source: ${page.source}`,
    `Content:\n${page.content}`,
    selectionBlock,
  ].join('\n\n');
}

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
  const [pageContext, setPageContext] = useState<PageContentResult | null>(null);
  const [pageContextError, setPageContextError] = useState<string | null>(null);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [quickPromptDraft, setQuickPromptDraft] = useState('');
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

  const loadPageContext = async () => {
    setIsContextLoading(true);
    setPageContextError(null);

    try {
      const response = (await chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTENT' })) as GetPageContentResponse;

      if (!response?.ok) {
        setPageContext(null);
        setPageContextError(response?.message ?? 'Failed to load page context.');
        return;
      }

      setPageContext(response.page);
    } catch (error) {
      setPageContext(null);
      setPageContextError(error instanceof Error ? error.message : 'Failed to load page context.');
    } finally {
      setIsContextLoading(false);
    }
  };

  useEffect(() => {
    if (mode !== 'ai') {
      return;
    }

    void loadPageContext();
  }, [mode]);

  const contextSystemMessage = pageContext
    ? [
        'You are helping the user with the currently open page.',
        `Page title: ${pageContext.title}`,
        `Page URL: ${pageContext.url}`,
        pageContext.selection ? `Selected text: ${pageContext.selection}` : 'Selected text: none',
        `Page content:\n${pageContext.content}`,
      ].join('\n\n')
    : undefined;

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
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
            <ModelPicker value={selectedModelId} onChange={setSelectedModelId} />
            <button
              type="button"
              onClick={() => {
                if (!pageContext) {
                  return;
                }

                setQuickPromptDraft(buildPageSummarizePrompt(pageContext));
              }}
              disabled={!pageContext}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Summarize this page
            </button>
          </div>

          {pageContext ? (
            <ContextBar
              title={pageContext.title}
              source={pageContext.source}
              warning={pageContext.warning}
            />
          ) : null}

          {isContextLoading ? (
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Loading page context...
            </div>
          ) : null}

          {pageContextError ? (
            <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {pageContextError}
            </div>
          ) : null}

          <ChatWindow
            modelId={selectedModelId}
            contextSystemMessage={contextSystemMessage}
            draftText={quickPromptDraft}
            onDraftTextChange={setQuickPromptDraft}
          />
        </section>
      )}
    </main>
  );
}

export default App;
