import { useState } from 'react';

import { Shell } from '../../src/components/layout/Shell';
import type { ActivePanel } from '../../src/components/layout/types';
import { usePageContext } from '../../src/lib/pageContext';

function App() {
  const [activePanel, setActivePanel] = useState<ActivePanel>('chat');
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
    />
  );
}

export default App;
