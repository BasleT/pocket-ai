import { useMemo, useRef, useState } from 'react';

import type { EmbedProvider } from './providerConfig';

type EmbedProviderProps = {
  provider: EmbedProvider;
  isActive: boolean;
};

export function EmbedProvider({ provider, isActive }: EmbedProviderProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isLoginRequired, setIsLoginRequired] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const hiddenClassName = isActive ? 'flex' : 'hidden';

  const loginHostSet = useMemo(() => new Set(provider.loginHosts), [provider.loginHosts]);

  const handleLoad = () => {
    setLoadError(null);

    try {
      const href = iframeRef.current?.contentWindow?.location.href;
      if (!href) {
        return;
      }

      const host = new URL(href).hostname;
      setIsLoginRequired(loginHostSet.has(host));
    } catch {
      setIsLoginRequired(false);
    }
  };

  const handleError = () => {
    setLoadError(`Unable to load ${provider.name} in the side panel.`);
  };

  return (
    <section className={`relative h-full w-full flex-col ${hiddenClassName}`} aria-hidden={!isActive}>
      {isLoginRequired ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/95 p-5">
          <div className="max-w-xs rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-900">Log in to {provider.name}</p>
            <p className="mt-2 text-xs text-slate-600">
              Your browser session is not authenticated for this provider.
            </p>
            <a
              className="mt-3 inline-flex rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"
              href={provider.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open {provider.name} login
            </a>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/95 p-5">
          <div className="max-w-xs rounded-lg border border-rose-200 bg-rose-50 p-4 text-center">
            <p className="text-sm font-medium text-rose-700">{loadError}</p>
            <p className="mt-2 text-xs text-rose-600">
              Try opening the provider in a new tab and then refresh this panel.
            </p>
          </div>
        </div>
      ) : null}

      <iframe
        ref={iframeRef}
        title={`${provider.name} embedded chat`}
        src={provider.url}
        className="h-full w-full border-0"
        onLoad={handleLoad}
        onError={handleError}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </section>
  );
}
