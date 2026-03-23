import { useState } from 'react';

import { Shell } from '../../src/components/layout/Shell';
import type { ActivePanel } from '../../src/components/layout/types';

function App() {
  const [activePanel, setActivePanel] = useState<ActivePanel>('chat');

  return <Shell activePanel={activePanel} onSelectPanel={setActivePanel} />;
}

export default App;
