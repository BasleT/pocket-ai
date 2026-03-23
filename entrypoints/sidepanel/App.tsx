import { useEffect, useMemo, useState } from 'react';

import { ChatWindow } from '../../src/components/Chat/ChatWindow';
import { PdfChat } from '../../src/components/PdfReader/PdfChat';
import { PdfUpload } from '../../src/components/PdfReader/PdfUpload';
import { EmbedProvider } from '../../src/components/providers/EmbedProvider';
import { EmbedProviderTab } from '../../src/components/providers/EmbedProviderTab';
import { SettingsPanel } from '../../src/components/Settings/SettingsPanel';
import { Skeleton } from '../../src/components/common/Skeleton';
import { OcrResultPanel } from '../../src/components/Summarizer/OcrResultPanel';
import { YouTubeSummarizer } from '../../src/components/Summarizer/YouTubeSummarizer';
import { ContextBar } from '../../src/components/Toolbar/ContextBar';
import { ModelPicker } from '../../src/components/Toolbar/ModelPicker';
import {
  DEFAULT_PROVIDER_ID,
  EMBED_PROVIDERS,
  type ProviderId,
} from '../../src/components/providers/providerConfig';
import { CHAT_MODELS, getAvailableModelsByConfiguredProviders } from '../../src/lib/ai';
import { buildPdfSystemContext, parsePdfFile } from '../../src/lib/extractors/pdf';
import { DEFAULT_OCR_LANGUAGE, normalizeOcrLanguage, type OcrLanguage } from '../../src/lib/extractors/ocr';
import { storageGet, storageGetSecret, storageRemoveSecret, storageSet, storageSetSecret } from '../../src/lib/storage';
import type { ChatModelId } from '../../src/types/chat';
import type { OcrResult, OcrUpdatedMessage } from '../../src/types/ocr';
import type { PdfParseProgress, PdfParseResult } from '../../src/types/pdf';
import type { GetPageContentResponse, PageContentResult } from '../../src/types/page';
import {
  API_KEY_FIELD_MAP,
  EMBED_PROVIDER_TOGGLE_STORAGE_KEY,
  THEME_MODE_STORAGE_KEY,
  type ApiProviderId,
  type ConnectionTestStatus,
  type EmbedProviderToggles,
  type TestConnectionResponse,
  type ThemeMode,
} from '../../src/types/settings';
import type { GetYouTubeContextResponse, YouTubeContextData } from '../../src/types/youtube';
import { OCR_LANGUAGE_STORAGE_KEY, OCR_RESULT_STORAGE_KEY } from '../../src/types/ocr';

type SidebarMode = 'embed' | 'ai';
type WorkspacePane = 'chat' | 'context' | 'settings';

type SessionState = {
  activeProviderId: ProviderId;
  openProviderIds: ProviderId[];
  mode: SidebarMode;
};

const OPEN_PROVIDERS_KEY = 'embedOpenProviderIds';
const ACTIVE_PROVIDER_KEY = 'embedActiveProviderId';
const SIDEBAR_MODE_KEY = 'sidebarMode';
const SELECTED_MODEL_KEY = 'aiSelectedModelId';

const DEFAULT_MODEL_ID = CHAT_MODELS[0].id;

function createDefaultEmbedProviderToggles(): EmbedProviderToggles {
  return EMBED_PROVIDERS.reduce<EmbedProviderToggles>((toggles, provider) => {
    toggles[provider.id] = true;
    return toggles;
  }, {} as EmbedProviderToggles);
}

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

function isChatModelId(value: string): value is ChatModelId {
  return CHAT_MODELS.some((model) => model.id === value);
}

function isProviderId(value: string): value is ProviderId {
  return EMBED_PROVIDERS.some((provider) => provider.id === value);
}

function App() {
  const [activeProviderId, setActiveProviderId] = useState<ProviderId>(DEFAULT_PROVIDER_ID);
  const [openProviderIds, setOpenProviderIds] = useState<ProviderId[]>([DEFAULT_PROVIDER_ID]);
  const [mode, setMode] = useState<SidebarMode>('embed');
  const [selectedModelId, setSelectedModelId] = useState<ChatModelId>(DEFAULT_MODEL_ID);
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [prefersDark, setPrefersDark] = useState(false);
  const [embedProviderToggles, setEmbedProviderToggles] = useState<EmbedProviderToggles>(
    createDefaultEmbedProviderToggles(),
  );
  const [apiKeyConfigured, setApiKeyConfigured] = useState<Record<ApiProviderId, boolean>>({
    groq: false,
    openai: false,
    anthropic: false,
    google: false,
  });
  const [connectionStatuses, setConnectionStatuses] = useState<
    Partial<Record<ApiProviderId, ConnectionTestStatus>>
  >({});
  const [pageContext, setPageContext] = useState<PageContentResult | null>(null);
  const [pageContextError, setPageContextError] = useState<string | null>(null);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [quickPromptDraft, setQuickPromptDraft] = useState('');
  const [youtubeContext, setYouTubeContext] = useState<YouTubeContextData | null>(null);
  const [isYouTubeLoading, setIsYouTubeLoading] = useState(false);
  const [parsedPdf, setParsedPdf] = useState<PdfParseResult | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isPdfParsing, setIsPdfParsing] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<PdfParseProgress | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [ocrLanguage, setOcrLanguage] = useState<OcrLanguage>(DEFAULT_OCR_LANGUAGE);
  const [sendRequest, setSendRequest] = useState<{ id: string; text: string } | null>(null);
  const [embedCopyStatus, setEmbedCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [workspacePane, setWorkspacePane] = useState<WorkspacePane>('chat');
  const [loadedFromSession, setLoadedFromSession] = useState(false);

  const openProviderIdSet = useMemo(() => new Set(openProviderIds), [openProviderIds]);
  const enabledEmbedProviders = useMemo(
    () => EMBED_PROVIDERS.filter((provider) => embedProviderToggles[provider.id] ?? true),
    [embedProviderToggles],
  );
  const configuredProviders = useMemo<ApiProviderId[]>(() => {
    const providers: ApiProviderId[] = [];
    if (apiKeyConfigured.groq || Boolean(import.meta.env.VITE_GROQ_API_KEY)) {
      providers.push('groq');
    }
    if (apiKeyConfigured.openai) {
      providers.push('openai');
    }
    if (apiKeyConfigured.anthropic) {
      providers.push('anthropic');
    }
    if (apiKeyConfigured.google) {
      providers.push('google');
    }
    return providers;
  }, [apiKeyConfigured]);
  const hasAnyApiProviderConfigured = configuredProviders.length > 0;
  const availableModels = useMemo(
    () => getAvailableModelsByConfiguredProviders(configuredProviders),
    [configuredProviders],
  );

  useEffect(() => {
    const loadSessionState = async () => {
      const [activeProvider, openProviders, savedMode, storedModelId, storedProviderToggles, storedThemeMode] = await Promise.all([
        storageGet<string>('session', ACTIVE_PROVIDER_KEY),
        storageGet<string[]>('session', OPEN_PROVIDERS_KEY),
        storageGet<string>('session', SIDEBAR_MODE_KEY),
        storageGet<string>('session', SELECTED_MODEL_KEY),
        storageGet<EmbedProviderToggles>('local', EMBED_PROVIDER_TOGGLE_STORAGE_KEY),
        storageGet<ThemeMode>('local', THEME_MODE_STORAGE_KEY),
      ]);

      const [storedOcrResult, storedOcrLanguage, groqApiKey, openAiApiKey, anthropicApiKey, googleApiKey] =
        await Promise.all([
        storageGet<OcrResult>('session', OCR_RESULT_STORAGE_KEY),
        storageGet<string>('local', OCR_LANGUAGE_STORAGE_KEY),
        storageGetSecret(API_KEY_FIELD_MAP.groq),
        storageGetSecret(API_KEY_FIELD_MAP.openai),
        storageGetSecret(API_KEY_FIELD_MAP.anthropic),
        storageGetSecret(API_KEY_FIELD_MAP.google),
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

      if (storedModelId && isChatModelId(storedModelId)) {
        setSelectedModelId(storedModelId);
      }

      if (storedProviderToggles) {
        setEmbedProviderToggles({
          ...createDefaultEmbedProviderToggles(),
          ...storedProviderToggles,
        });
      }

      if (storedThemeMode === 'light' || storedThemeMode === 'dark' || storedThemeMode === 'system') {
        setThemeMode(storedThemeMode);
      }

      if (storedOcrResult) {
        setOcrResult(storedOcrResult);
      }

      setOcrLanguage(normalizeOcrLanguage(storedOcrLanguage));

      setApiKeyConfigured({
        groq: Boolean(groqApiKey || import.meta.env.VITE_GROQ_API_KEY),
        openai: Boolean(openAiApiKey),
        anthropic: Boolean(anthropicApiKey),
        google: Boolean(googleApiKey),
      });

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
    void storageSet('local', EMBED_PROVIDER_TOGGLE_STORAGE_KEY, embedProviderToggles);
  }, [
    activeProviderId,
    embedProviderToggles,
    loadedFromSession,
    mode,
    openProviderIds,
    selectedModelId,
  ]);

  useEffect(() => {
    if (!loadedFromSession) {
      return;
    }

    void storageSet('local', OCR_LANGUAGE_STORAGE_KEY, ocrLanguage);
  }, [loadedFromSession, ocrLanguage]);

  useEffect(() => {
    if (!loadedFromSession) {
      return;
    }

    void storageSet('local', THEME_MODE_STORAGE_KEY, themeMode);
  }, [loadedFromSession, themeMode]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    setPrefersDark(media.matches);

    const listener = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    const onMessage = (message: OcrUpdatedMessage) => {
      if (!message || message.type !== 'OCR_RESULT_UPDATED') {
        return;
      }

      setOcrResult(message.result);
    };

    chrome.runtime.onMessage.addListener(onMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  const handleProviderSelect = (providerId: ProviderId) => {
    setActiveProviderId(providerId);
    setOpenProviderIds((previousIds) =>
      previousIds.includes(providerId) ? previousIds : [...previousIds, providerId],
    );
  };

  const handleEmbedProviderToggle = (providerId: ProviderId, enabled: boolean) => {
    setEmbedProviderToggles((previous) => {
      const next = { ...previous, [providerId]: enabled };
      if (!Object.values(next).some(Boolean)) {
        next[providerId] = true;
      }
      return next;
    });
  };

  const handleSaveApiKey = async (provider: ApiProviderId, value: string) => {
    const field = API_KEY_FIELD_MAP[provider];
    if (!value.trim()) {
      return;
    }

    await storageSetSecret(field, value.trim());
    setApiKeyConfigured((previous) => ({ ...previous, [provider]: true }));
  };

  const handleClearApiKey = async (provider: ApiProviderId) => {
    const field = API_KEY_FIELD_MAP[provider];
    await storageRemoveSecret(field);
    setApiKeyConfigured((previous) => ({ ...previous, [provider]: false }));
  };

  const handleTestConnection = async (provider: ApiProviderId) => {
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

  const handleCopyEmbedPrompt = async () => {
    try {
      const response = (await chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTENT' })) as GetPageContentResponse;
      if (!response?.ok) {
        setEmbedCopyStatus('error');
        return;
      }

      await navigator.clipboard.writeText(buildPageSummarizePrompt(response.page));
      setEmbedCopyStatus('copied');
      window.setTimeout(() => setEmbedCopyStatus('idle'), 1800);
    } catch {
      setEmbedCopyStatus('error');
      window.setTimeout(() => setEmbedCopyStatus('idle'), 1800);
    }
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

  const loadYouTubeContext = async () => {
    setIsYouTubeLoading(true);

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'GET_YOUTUBE_CONTEXT',
      })) as GetYouTubeContextResponse;

      if (!response?.ok) {
        setYouTubeContext(null);
        return;
      }

      setYouTubeContext(response.data);
    } catch {
      setYouTubeContext(null);
    } finally {
      setIsYouTubeLoading(false);
    }
  };

  useEffect(() => {
    if (mode !== 'ai') {
      return;
    }

    void loadPageContext();
    void loadYouTubeContext();
  }, [mode]);

  useEffect(() => {
    if (mode === 'embed') {
      setWorkspacePane('chat');
    }
  }, [mode]);

  useEffect(() => {
    const enabledIds = new Set(enabledEmbedProviders.map((provider) => provider.id));

    if (!enabledIds.has(activeProviderId) && enabledEmbedProviders.length > 0) {
      setActiveProviderId(enabledEmbedProviders[0].id);
    }

    setOpenProviderIds((previous) => {
      const filtered = previous.filter((providerId) => enabledIds.has(providerId));
      if (filtered.length > 0) {
        return filtered;
      }

      if (enabledEmbedProviders.length > 0) {
        return [enabledEmbedProviders[0].id];
      }

      return previous;
    });
  }, [activeProviderId, enabledEmbedProviders]);

  useEffect(() => {
    if (!availableModels.some((model) => model.id === selectedModelId) && availableModels.length > 0) {
      setSelectedModelId(availableModels[0].id);
    }
  }, [availableModels, selectedModelId]);

  const isDark = themeMode === 'dark' || (themeMode === 'system' && prefersDark);

  const contextSections: string[] = [];

  if (pageContext) {
    contextSections.push(
      [
        'You are helping the user with the currently open page.',
        `Page title: ${pageContext.title}`,
        `Page URL: ${pageContext.url}`,
        pageContext.selection ? `Selected text: ${pageContext.selection}` : 'Selected text: none',
        `Page content:\n${pageContext.content}`,
      ].join('\n\n'),
    );
  }

  if (parsedPdf) {
    contextSections.push(
      buildPdfSystemContext({
        fileName: parsedPdf.fileName,
        pageCount: parsedPdf.pageCount,
        source: parsedPdf.source,
        chunks: parsedPdf.chunks,
      }),
    );
  }

  const contextSystemMessage = contextSections.length > 0 ? contextSections.join('\n\n---\n\n') : undefined;
  const contextReadyCount =
    (pageContext ? 1 : 0) +
    (youtubeContext?.hasTranscript ? 1 : 0) +
    (parsedPdf ? 1 : 0) +
    (ocrResult?.text ? 1 : 0);

  const handlePdfFileSelected = async (file: File) => {
    setIsPdfParsing(true);
    setPdfError(null);
    setPdfProgress(null);

    try {
      const result = await parsePdfFile(file, {
        onProgress: (progress) => setPdfProgress(progress),
      });

      setParsedPdf(result);
    } catch (error) {
      setParsedPdf(null);
      setPdfError(error instanceof Error ? error.message : 'Failed to parse PDF.');
    } finally {
      setIsPdfParsing(false);
    }
  };

  return (
    <main className={`${isDark ? 'dark' : ''} ui-shell`}>
      <header className="ui-header">
        <div>
          <h1 className="text-sm font-semibold">Pocket AI</h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Sider-style workspace</p>
        </div>
        <div className="ui-mode-switch">
          <button
            type="button"
            className={`ui-mode-btn ${mode === 'embed' ? 'ui-mode-btn-active' : ''}`}
            onClick={() => setMode('embed')}
            aria-label="Switch to embed mode"
          >
            Embed
          </button>
          <button
            type="button"
            className={`ui-mode-btn ${mode === 'ai' ? 'ui-mode-btn-active' : ''}`}
            onClick={() => {
              if (!hasAnyApiProviderConfigured) {
                return;
              }
              setMode('ai');
            }}
            aria-label="Switch to AI mode"
            disabled={!hasAnyApiProviderConfigured}
            title={!hasAnyApiProviderConfigured ? 'Configure an API key in Settings first' : undefined}
          >
            AI
          </button>
        </div>
      </header>

      {mode === 'embed' ? (
        <>
          <EmbedProviderTab
            providers={enabledEmbedProviders}
            activeId={activeProviderId}
            onSelect={handleProviderSelect}
          />
          <div className="ui-embed-hint">
            <p>Embed mode uses your logged-in provider sites. Context tools are copy/paste.</p>
            <button
              type="button"
              onClick={() => {
                void handleCopyEmbedPrompt();
              }}
              className="ui-embed-hint-btn"
            >
              {embedCopyStatus === 'copied'
                ? 'Copied'
                : embedCopyStatus === 'error'
                  ? 'Copy Failed'
                  : 'Copy Page Prompt'}
            </button>
          </div>
          <div className="relative min-h-0 flex-1 bg-slate-950">
            {enabledEmbedProviders.filter((provider) => openProviderIdSet.has(provider.id)).map((provider) => (
              <EmbedProvider
                key={provider.id}
                provider={provider}
                isActive={provider.id === activeProviderId}
              />
            ))}
          </div>
        </>
      ) : (
        <section className="ui-workspace">
          <aside className="ui-rail">
            <button
              type="button"
              onClick={() => setWorkspacePane('chat')}
              className={`ui-rail-btn ${workspacePane === 'chat' ? 'ui-rail-btn-active' : ''}`}
              aria-label="Show chat workspace"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => setWorkspacePane('context')}
              className={`ui-rail-btn ${workspacePane === 'context' ? 'ui-rail-btn-active' : ''}`}
              aria-label="Show context workspace"
            >
              X
            </button>
            <button
              type="button"
              onClick={() => setWorkspacePane('settings')}
              className={`ui-rail-btn ${workspacePane === 'settings' ? 'ui-rail-btn-active' : ''}`}
              aria-label="Show settings workspace"
            >
              S
            </button>
          </aside>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="ui-command-card">
              <div className="flex items-center justify-between gap-2">
                <ModelPicker value={selectedModelId} models={availableModels} onChange={setSelectedModelId} />
                <button
                  type="button"
                  onClick={() => {
                    if (!pageContext) {
                      return;
                    }

                    setQuickPromptDraft(buildPageSummarizePrompt(pageContext));
                  }}
                  disabled={!pageContext}
                  className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Summarize current page"
                >
                  Summarize page
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                <span className="ui-stat-chip">Context ready: {contextReadyCount}</span>
                <span className="ui-stat-chip">
                  Provider keys: {configuredProviders.length}
                </span>
                {!hasAnyApiProviderConfigured ? (
                  <span className="ui-stat-chip-warn">
                    Add API key in Settings
                  </span>
                ) : null}
              </div>
            </div>

            {workspacePane === 'settings' ? (
              <div className="ui-settings-wrap">
                <SettingsPanel
                  embedProviderToggles={embedProviderToggles}
                  apiKeyConfigured={apiKeyConfigured}
                  connectionStatuses={connectionStatuses}
                  themeMode={themeMode}
                  onProviderToggle={handleEmbedProviderToggle}
                  onThemeModeChange={setThemeMode}
                  onSaveApiKey={handleSaveApiKey}
                  onClearApiKey={handleClearApiKey}
                  onTestConnection={handleTestConnection}
                />
              </div>
            ) : null}

            {workspacePane === 'context' ? (
              <div className="mx-3 mt-3 space-y-2 overflow-y-auto">
                {pageContext ? (
                  <ContextBar title={pageContext.title} source={pageContext.source} warning={pageContext.warning} />
                ) : null}

                {isContextLoading ? (
                  <div className="ui-soft-card">
                    <Skeleton className="h-3 w-40" />
                  </div>
                ) : null}

                {pageContextError ? (
                  <div className="ui-warning">
                    {pageContextError}
                  </div>
                ) : null}

                {youtubeContext?.isYouTubePage ? (
                  <YouTubeSummarizer
                    context={youtubeContext}
                    isLoading={isYouTubeLoading}
                    onRefresh={() => {
                      void loadYouTubeContext();
                    }}
                    onSummarize={(prompt) => {
                      setQuickPromptDraft(prompt);
                      setSendRequest({ id: crypto.randomUUID(), text: prompt });
                      setWorkspacePane('chat');
                    }}
                  />
                ) : null}

                <OcrResultPanel
                  result={ocrResult}
                  selectedLanguage={ocrLanguage}
                  onLanguageChange={setOcrLanguage}
                />

                <PdfUpload
                  isParsing={isPdfParsing}
                  progress={pdfProgress}
                  pageCount={parsedPdf?.pageCount ?? null}
                  onFileSelected={(file) => {
                    void handlePdfFileSelected(file);
                  }}
                />

                <PdfChat
                  parsedPdf={parsedPdf}
                  errorMessage={pdfError}
                  onClear={() => {
                    setParsedPdf(null);
                    setPdfError(null);
                    setPdfProgress(null);
                  }}
                />
              </div>
            ) : null}

            {workspacePane !== 'settings' ? (
              <div className="ui-chat-wrap">
                <ChatWindow
                  modelId={selectedModelId}
                  contextSystemMessage={contextSystemMessage}
                  draftText={quickPromptDraft}
                  onDraftTextChange={setQuickPromptDraft}
                  sendRequest={sendRequest}
                  onSendRequestHandled={(id) => {
                    setSendRequest((previous) => (previous?.id === id ? null : previous));
                    setQuickPromptDraft('');
                  }}
                />
              </div>
            ) : null}
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
