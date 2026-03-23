import { useEffect, useState } from 'react';

import { Shell } from '../../src/components/layout/Shell';
import type { ActivePanel } from '../../src/components/layout/types';
import { CHAT_MODELS } from '../../src/lib/ai';
import { usePageContext } from '../../src/lib/pageContext';
import { storageGet, storageSet } from '../../src/lib/storage';
import type { ChatModelId } from '../../src/types/chat';
import type { ThemeMode } from '../../src/types/settings';

const MODEL_STORAGE_KEY = 'settings.modelId';
const THEME_STORAGE_KEY = 'settings.themeMode';

const DEFAULT_MODEL_ID: ChatModelId = CHAT_MODELS[0].id;

function App() {
  const [activePanel, setActivePanel] = useState<ActivePanel>('chat');
  const [chatSendRequest, setChatSendRequest] = useState<{ id: string; text: string } | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<ChatModelId>(DEFAULT_MODEL_ID);
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const { page, loading, error } = usePageContext();

  const pageTitle = loading
    ? 'Loading page context...'
    : page?.title || 'No active page context';

  const pageWarning = error ?? page?.warning;

  useEffect(() => {
    const loadSettings = async () => {
      const [storedModel, storedTheme] = await Promise.all([
        storageGet<string>('local', MODEL_STORAGE_KEY),
        storageGet<ThemeMode>('local', THEME_STORAGE_KEY),
      ]);

      if (storedModel && CHAT_MODELS.some((model) => model.id === storedModel)) {
        setSelectedModelId(storedModel as ChatModelId);
      }

      if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
        setThemeMode(storedTheme);
      }
    };

    void loadSettings();
  }, []);

  useEffect(() => {
    void storageSet('local', MODEL_STORAGE_KEY, selectedModelId);
  }, [selectedModelId]);

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const useDark = themeMode === 'dark' || (themeMode === 'system' && prefersDark);

    document.documentElement.classList.toggle('dark', useDark);
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
      onThemeModeChange={(theme) => {
        setThemeMode(theme);
        void storageSet('local', THEME_STORAGE_KEY, theme);
      }}
    />
  );
}

export default App;
