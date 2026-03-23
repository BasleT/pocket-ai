import { useEffect, useRef, useState } from 'react';

import { Shell } from '../../src/components/layout/Shell';
import type { ActivePanel } from '../../src/components/layout/types';
import { CHAT_MODELS } from '../../src/lib/ai';
import { usePageContext } from '../../src/lib/pageContext';
import { storageGet, storageSet } from '../../src/lib/storage';
import type { ChatModelId } from '../../src/types/chat';
import type { PageContentResult } from '../../src/types/page';
import type { ThemeMode } from '../../src/types/settings';

const MODEL_STORAGE_KEY = 'settings.modelId';
const THEME_STORAGE_KEY = 'settings.themeMode';
const CARRY_CONTEXT_STORAGE_KEY = 'settings.carryContext';
const PENDING_SELECTION_PROMPT_PREFIX = 'chat:pendingSelectionPrompt:';

const DEFAULT_MODEL_ID: ChatModelId = CHAT_MODELS[0].id;

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

function createPendingSelectionPromptKey(tabId: number): string {
  return `${PENDING_SELECTION_PROMPT_PREFIX}${tabId}`;
}

function App() {
  const [activePanel, setActivePanel] = useState<ActivePanel>('chat');
  const [chatSendRequest, setChatSendRequest] = useState<{ id: string; text: string } | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<ChatModelId>(DEFAULT_MODEL_ID);
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [carryContext, setCarryContext] = useState(false);
  const [previousPageContext, setPreviousPageContext] = useState<PageContentResult | null>(null);
  const lastPageContextRef = useRef<PageContentResult | null>(null);
  const { page, loading, error } = usePageContext();

  const pageTitle = loading
    ? 'Loading page context...'
    : page?.title || 'No active page context';

  const pageWarning = error ?? page?.warning;

  useEffect(() => {
    const loadSettings = async () => {
      const [storedModel, storedTheme, storedCarryContext] = await Promise.all([
        storageGet<string>('local', MODEL_STORAGE_KEY),
        storageGet<ThemeMode>('local', THEME_STORAGE_KEY),
        storageGet<boolean>('local', CARRY_CONTEXT_STORAGE_KEY),
      ]);

      if (storedModel && CHAT_MODELS.some((model) => model.id === storedModel)) {
        setSelectedModelId(storedModel as ChatModelId);
      }

      if (storedTheme === 'light' || storedTheme === 'dark') {
        setThemeMode(storedTheme);
      }

      if (storedTheme === 'system') {
        setThemeMode('dark');
      }

      setCarryContext(Boolean(storedCarryContext));
    };

    void loadSettings();
  }, []);

  useEffect(() => {
    if (!page?.url || !page.content) {
      return;
    }

    const lastPage = lastPageContextRef.current;
    if (lastPage && lastPage.url !== page.url) {
      setPreviousPageContext(lastPage);
    }

    lastPageContextRef.current = page;
  }, [page]);

  useEffect(() => {
    const onRuntimeMessage = (message: unknown) => {
      if (
        !message ||
        typeof message !== 'object' ||
        !('type' in message) ||
        (message as { type?: string }).type !== 'SELECTION_ACTION_CHAT'
      ) {
        return;
      }

      const prompt = (message as { prompt?: string }).prompt;
      if (!prompt || typeof prompt !== 'string') {
        return;
      }

      setActivePanel('chat');
      setChatSendRequest({
        id: crypto.randomUUID(),
        text: prompt,
      });
    };

    chrome.runtime.onMessage.addListener(onRuntimeMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    };
  }, []);

  useEffect(() => {
    const consumePendingSelectionPrompt = async () => {
      const activeTabId = await getActiveTabId();
      if (!activeTabId) {
        return;
      }

      const key = createPendingSelectionPromptKey(activeTabId);
      const stored = await chrome.storage.session.get(key);
      const prompt = stored[key] as string | undefined;
      if (!prompt) {
        return;
      }

      await chrome.storage.session.remove(key);
      setActivePanel('chat');
      setChatSendRequest({ id: crypto.randomUUID(), text: prompt });
    };

    void consumePendingSelectionPrompt();
  }, []);

  useEffect(() => {
    void storageSet('local', MODEL_STORAGE_KEY, selectedModelId);
  }, [selectedModelId]);

  useEffect(() => {
    const html = document.documentElement;
    const useDark = themeMode === 'dark';

    html.classList.toggle('dark', useDark);
    html.classList.toggle('light', !useDark);
  }, [themeMode]);

  return (
    <Shell
      activePanel={activePanel}
      onSelectPanel={setActivePanel}
      pageTitle={pageTitle}
      pageWarning={pageWarning}
      pageContext={page}
      chatSendRequest={chatSendRequest}
      onChatSendRequestHandled={(id) => {
        setChatSendRequest((previous) => (previous?.id === id ? null : previous));
      }}
      onAskFollowUp={(summary) => {
        setActivePanel('chat');
        setChatSendRequest({
          id: crypto.randomUUID(),
          text: `Use this summary as context and answer follow-up questions:\n\n${summary}`,
        });
      }}
      selectedModelId={selectedModelId}
      onModelChange={(modelId) => setSelectedModelId(modelId)}
      themeMode={themeMode}
      carryContext={carryContext}
      previousPageContext={previousPageContext && previousPageContext.url !== page?.url ? previousPageContext : null}
      onThemeModeChange={(theme) => {
        setThemeMode(theme);
        void storageSet('local', THEME_STORAGE_KEY, theme);
      }}
      onCarryContextChange={(next: boolean) => {
        setCarryContext(next);
        void storageSet('local', CARRY_CONTEXT_STORAGE_KEY, next);
      }}
    />
  );
}

export default App;
