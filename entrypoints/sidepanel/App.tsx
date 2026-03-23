import { useState } from 'react';

import { Shell } from '../../src/components/layout/Shell';
import type { ActivePanel } from '../../src/components/layout/types';
import { usePageContext } from '../../src/lib/pageContext';

function App() {
  const [activePanel, setActivePanel] = useState<ActivePanel>('chat');
  const [chatSendRequest, setChatSendRequest] = useState<{ id: string; text: string } | null>(null);
  const { page, loading, error } = usePageContext();

  const pageTitle = loading
    ? 'Loading page context...'
    : page?.title || 'No active page context';

  const pageWarning = error ?? page?.warning;

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
    />
  );
}

export default App;
