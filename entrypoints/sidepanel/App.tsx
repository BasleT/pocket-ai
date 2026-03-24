import { useCallback, useEffect, useState } from 'react';

import { Shell } from '../../src/components/layout/Shell';
import type { ActivePanel } from '../../src/components/layout/types';
import { CHAT_MODELS } from '../../src/lib/ai';
import {
  FEATURE_TOGGLES_STORAGE_KEY,
  PRIVATE_MODE_STORAGE_KEY,
  getEffectiveFeatureToggles,
  normalizeFeatureToggles,
  type FeatureToggleId,
  type FeatureToggles,
} from '../../src/lib/featureToggles';
import { usePageContext } from '../../src/lib/pageContext';
import { storageGet, storageSet } from '../../src/lib/storage';
import type { ChatModelId } from '../../src/types/chat';
import type { PageContentResult } from '../../src/types/page';
import type { ThemeMode } from '../../src/types/settings';

const MODEL_STORAGE_KEY = 'settings.modelId';
const THEME_STORAGE_KEY = 'settings.themeMode';
const PENDING_SELECTION_PROMPT_PREFIX = 'chat:pendingSelectionPrompt:';
const GLOBAL_PENDING_SELECTION_PROMPT_KEY = 'chat:pendingSelectionPrompt';

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
  const [privateMode, setPrivateMode] = useState(false);
  const [featureToggles, setFeatureToggles] = useState<FeatureToggles>(normalizeFeatureToggles(undefined));
  const [previousPageContext, setPreviousPageContext] = useState<PageContentResult | null>(null);
  const { page, previousPage, loading, error } = usePageContext();
  const effectiveToggles = getEffectiveFeatureToggles(featureToggles, privateMode);

  const pageTitle = loading
    ? 'Loading page context...'
    : page?.title || 'No active page context';

  const pageWarning = error ?? page?.warning;

  const consumePendingSelectionPrompt = useCallback(async () => {
    const activeTabId = await getActiveTabId();
    const keys = [GLOBAL_PENDING_SELECTION_PROMPT_KEY];
    if (activeTabId) {
      keys.unshift(createPendingSelectionPromptKey(activeTabId));
    }

    const stored = await chrome.storage.session.get(keys);
    const pending =
      (activeTabId
        ? (stored[createPendingSelectionPromptKey(activeTabId)] as { action: string; text: string } | undefined)
        : undefined) ??
      (stored[GLOBAL_PENDING_SELECTION_PROMPT_KEY] as { action: string; text: string } | undefined);
    if (!pending) {
      return;
    }

    await chrome.storage.session.remove(keys);
    setActivePanel('chat');
    setChatSendRequest({ id: crypto.randomUUID(), text: `${pending.action} this: ${pending.text}` });
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      const [storedModel, storedTheme, storedPrivateMode, storedFeatureToggles, legacyCarryContext] = await Promise.all([
        storageGet<string>('local', MODEL_STORAGE_KEY),
        storageGet<ThemeMode>('local', THEME_STORAGE_KEY),
        storageGet<boolean>('local', PRIVATE_MODE_STORAGE_KEY),
        storageGet<Partial<FeatureToggles>>('local', FEATURE_TOGGLES_STORAGE_KEY),
        storageGet<boolean>('local', 'carryContext'),
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

      const normalized = normalizeFeatureToggles(storedFeatureToggles);
      if (typeof legacyCarryContext === 'boolean') {
        normalized.carryContext = legacyCarryContext;
      }

      setPrivateMode(Boolean(storedPrivateMode));
      setFeatureToggles(normalized);

      await Promise.all([
        storageSet('local', FEATURE_TOGGLES_STORAGE_KEY, normalized),
        storageSet('local', PRIVATE_MODE_STORAGE_KEY, Boolean(storedPrivateMode)),
      ]);
    };

    void loadSettings();
  }, []);

  useEffect(() => {
    setPreviousPageContext(previousPage ?? null);
  }, [previousPage]);

  useEffect(() => {
    const onStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== 'local') {
        return;
      }

      if (changes[PRIVATE_MODE_STORAGE_KEY]) {
        setPrivateMode(Boolean(changes[PRIVATE_MODE_STORAGE_KEY].newValue));
      }

      if (changes[FEATURE_TOGGLES_STORAGE_KEY]) {
        setFeatureToggles(normalizeFeatureToggles(changes[FEATURE_TOGGLES_STORAGE_KEY].newValue as Partial<FeatureToggles>));
      }
    };

    chrome.storage.onChanged.addListener(onStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(onStorageChange);
    };
  }, []);

  useEffect(() => {
    const onRuntimeMessage = (message: unknown) => {
      if (
        !message ||
        typeof message !== 'object' ||
        !('type' in message) ||
        (message as { type?: string }).type !== 'SELECTION_ACTION'
      ) {
        return;
      }

      const action = (message as { action?: string }).action;
      const text = (message as { text?: string }).text;
      if (!action || !text || typeof action !== 'string' || typeof text !== 'string') {
        return;
      }

      const prompt = `${action} this: ${text}`;

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
    void consumePendingSelectionPrompt();

    const onStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== 'session') {
        return;
      }

      if (!changes[GLOBAL_PENDING_SELECTION_PROMPT_KEY]) {
        return;
      }

      void consumePendingSelectionPrompt();
    };

    chrome.storage.onChanged.addListener(onStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(onStorageChange);
    };
  }, [consumePendingSelectionPrompt]);

  useEffect(() => {
    void storageSet('local', MODEL_STORAGE_KEY, selectedModelId);
  }, [selectedModelId]);

  useEffect(() => {
    const html = document.documentElement;
    const useDark = themeMode === 'dark';

    html.classList.toggle('dark', useDark);
    html.classList.toggle('light', !useDark);
  }, [themeMode]);

  useEffect(() => {
    const panelEnabledMap: Record<ActivePanel, boolean> = {
      chat: effectiveToggles.chatPanel,
      summarize: effectiveToggles.summarizePanel,
      youtube: effectiveToggles.youtubePanel,
      pdf: effectiveToggles.pdfPanel,
      ocr: effectiveToggles.ocrPanel,
      settings: true,
    };

    if (panelEnabledMap[activePanel]) {
      return;
    }

    if (panelEnabledMap.chat) {
      setActivePanel('chat');
      return;
    }

    setActivePanel('settings');
  }, [activePanel, effectiveToggles]);

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
      onNavigateToSettings={() => {
        setActivePanel('settings');
      }}
      selectedModelId={selectedModelId}
      onModelChange={(modelId) => setSelectedModelId(modelId)}
      themeMode={themeMode}
      privateMode={privateMode}
      featureToggles={featureToggles}
      effectiveFeatureToggles={effectiveToggles}
      carryContext={effectiveToggles.carryContext}
      previousPageContext={previousPageContext && previousPageContext.url !== page?.url ? previousPageContext : null}
      onThemeModeChange={(theme) => {
        setThemeMode(theme);
        void storageSet('local', THEME_STORAGE_KEY, theme);
      }}
      onPrivateModeChange={(next: boolean) => {
        setPrivateMode(next);
        void storageSet('local', PRIVATE_MODE_STORAGE_KEY, next);
      }}
      onFeatureToggleChange={(toggleId: FeatureToggleId, enabled: boolean) => {
        setFeatureToggles((previous) => {
          const next = { ...previous, [toggleId]: enabled };
          void storageSet('local', FEATURE_TOGGLES_STORAGE_KEY, next);
          return next;
        });
      }}
    />
  );
}

export default App;
