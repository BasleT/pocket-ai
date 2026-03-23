import React from 'react';
import ReactDOM from 'react-dom/client';

function Popup() {
  return <div style={{ padding: 12, fontFamily: 'sans-serif' }}>Open the side panel from the toolbar icon.</div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
