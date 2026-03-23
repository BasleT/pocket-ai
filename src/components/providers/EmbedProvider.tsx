import { useEffect, useMemo, useRef, useState } from 'react';

import type { EmbedProvider } from './providerConfig';

type EmbedProviderProps = {
  provider: EmbedProvider;
  isActive: boolean;
};

const LOAD_TIMEOUT_MS = 10_000;

function isLikelyLoginPath(pathname: string): boolean {
  const value = pathname.toLowerCase();
  return value.includes('login') || value.includes('signin') || value.includes('auth');
}

export function EmbedProvider({ provider, isActive }: EmbedProviderProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isLoginRequired, setIsLoginRequired] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [embedUrlIndex, setEmbedUrlIndex] = useState(0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [autoFallbackUsed, setAutoFallbackUsed] = useState(false);

  const hiddenClassName = isActive ? 'flex' : 'hidden';
  const loginHostSet = useMemo(() => new Set(provider.loginHosts), [provider.loginHosts]);

  const currentEmbedUrl = provider.embedUrls[embedUrlIndex] ?? provider.url;
  const canFallback = embedUrlIndex < provider.embedUrls.length - 1;

  const resetLoadState = () => {
    setIsLoginRequired(false);
    setLoadError(null);
    setHasLoaded(false);
  };

  const useFallbackUrl = () => {
    if (!canFallback) {
      return false;
    }

    setEmbedUrlIndex((previous) => previous + 1);
    setAutoFallbackUsed(true);
    setReloadNonce((previous) => previous + 1);
    resetLoadState();
    return true;
  };

  const retryEmbed = () => {
    resetLoadState();
    setReloadNonce((previous) => previous + 1);
  };

  useEffect(() => {
    setEmbedUrlIndex(0);
    setAutoFallbackUsed(false);
    setReloadNonce(0);
    resetLoadState();
  }, [provider.id]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (hasLoaded) {
        return;
      }

      setLoadError(`Could not load ${provider.name} in the panel.`);
    }, LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hasLoaded, isActive, provider.name, currentEmbedUrl, reloadNonce]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const onFocus = () => {
      if (!isLoginRequired && !loadError) {
        return;
      }

      window.setTimeout(() => {
        retryEmbed();
      }, 250);
    };

    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [isActive, isLoginRequired, loadError]);

  const handleLoad = () => {
    setHasLoaded(true);
    setLoadError(null);

    try {
      const href = iframeRef.current?.contentWindow?.location.href;
      if (!href) {
        return;
      }

      if (href.startsWith('chrome-error://')) {
        const switched = !autoFallbackUsed && useFallbackUrl();
        if (!switched) {
          setLoadError(`Embedding ${provider.name} is blocked by that site right now.`);
        }
        return;
      }

      const parsed = new URL(href);
      const needsLogin = loginHostSet.has(parsed.hostname) && isLikelyLoginPath(parsed.pathname);
      setIsLoginRequired(needsLogin);
    } catch {
      setIsLoginRequired(false);
    }
  };

  const handleError = () => {
    const switched = !autoFallbackUsed && useFallbackUrl();
    if (switched) {
      return;
    }

    setLoadError(`Unable to load ${provider.name} in the side panel.`);
  };

  return (
    <section className={`relative h-full w-full flex-col bg-slate-950 ${hiddenClassName}`} aria-hidden={!isActive}>
      {isLoginRequired ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/90 p-5">
          <div className="max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-center shadow-xl">
            <p className="text-sm font-semibold text-slate-100">Finish login in browser tab</p>
            <p className="mt-2 text-xs text-slate-300">
              {provider.name} opened a login/challenge page. Complete login, then come back and retry.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <a
                className="inline-flex rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-400"
                href={provider.loginUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                Open Login Tab
              </a>
              <button
                type="button"
                onClick={retryEmbed}
                className="inline-flex rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              >
                I Logged In, Retry
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/90 p-5">
          <div className="max-w-sm rounded-2xl border border-rose-700/50 bg-slate-900 p-5 text-center shadow-xl">
            <p className="text-sm font-semibold text-rose-300">{loadError}</p>
            <p className="mt-2 text-xs text-slate-300">Current URL: {currentEmbedUrl}</p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={retryEmbed}
                className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-white"
              >
                Retry Embed
              </button>
              <a
                className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                href={provider.loginUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                Open in Tab
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <iframe
        key={`${provider.id}-${currentEmbedUrl}-${reloadNonce}`}
        ref={iframeRef}
        title={`${provider.name} embedded chat`}
        src={currentEmbedUrl}
        className="h-full w-full border-0"
        onLoad={handleLoad}
        onError={handleError}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </section>
  );
}
