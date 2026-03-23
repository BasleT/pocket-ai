type RuntimeMessageListener = (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) =>
  boolean | void;

type ListenerSet<T> = {
  addListener: (listener: T) => void;
  removeListener: (listener: T) => void;
};

function createListenerSet<T>(): ListenerSet<T> & { values: () => T[] } {
  const listeners = new Set<T>();

  return {
    addListener(listener: T) {
      listeners.add(listener);
    },
    removeListener(listener: T) {
      listeners.delete(listener);
    },
    values() {
      return Array.from(listeners);
    },
  };
}

function createStorageArea() {
  const data = new Map<string, unknown>();

  return {
    async get(keys?: string | string[] | Record<string, unknown>) {
      if (!keys) {
        return Object.fromEntries(data.entries());
      }

      if (typeof keys === 'string') {
        return { [keys]: data.get(keys) };
      }

      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map((key) => [key, data.get(key)]));
      }

      const result: Record<string, unknown> = {};
      for (const key of Object.keys(keys)) {
        result[key] = data.has(key) ? data.get(key) : keys[key];
      }

      return result;
    },

    async set(values: Record<string, unknown>) {
      for (const [key, value] of Object.entries(values)) {
        data.set(key, value);
      }
    },

    async remove(keys: string | string[]) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const key of keyList) {
        data.delete(key);
      }
    },
  };
}

function installChromePreviewShim() {
  const maybeChrome = (globalThis as { chrome?: unknown }).chrome as
    | {
        runtime?: { id?: string };
      }
    | undefined;

  if (maybeChrome?.runtime?.id) {
    return;
  }

  const runtimeMessageListeners = createListenerSet<RuntimeMessageListener>();

  const emitRuntimeMessage = (message: unknown) => {
    for (const listener of runtimeMessageListeners.values()) {
      listener(message, {}, () => {});
    }
  };

  const storageLocal = createStorageArea();
  const storageSession = createStorageArea();

  const chromeShim = {
    runtime: {
      onMessage: {
        addListener(listener: RuntimeMessageListener) {
          runtimeMessageListeners.addListener(listener);
        },
        removeListener(listener: RuntimeMessageListener) {
          runtimeMessageListeners.removeListener(listener);
        },
      },

      async sendMessage(message: unknown) {
        const typed = message as { type?: string; provider?: string };

        if (typed?.type === 'GET_PAGE_CONTENT') {
          return {
            ok: true,
            page: {
              title: 'Preview Page Title',
              url: 'https://example.com/preview',
              content:
                'This is preview content returned by chromePreviewShim so the sidepanel can run in a regular browser for UI testing.',
              source: 'fallback',
            },
          };
        }

        if (typed?.type === 'GET_YOUTUBE_CONTEXT') {
          return {
            ok: true,
            data: {
              isYouTubePage: false,
              hasTranscript: false,
              title: '',
              url: '',
              videoId: null,
              transcriptChunks: [],
            },
          };
        }

        if (typed?.type === 'TEST_PROVIDER_CONNECTION') {
          return {
            ok: true,
            message: `Preview mode: ${typed.provider ?? 'provider'} connection simulated`,
          };
        }

        if (typed?.type === 'KEEP_ALIVE') {
          return { ok: true };
        }

        emitRuntimeMessage(message);
        return { ok: true };
      },

      connect() {
        const messageListeners = createListenerSet<(message: unknown) => void>();
        let isDisconnected = false;

        const sendChunkedResponse = (requestId: string) => {
          const words =
            'Preview stream response from chrome shim. This lets you inspect UI in a normal browser before extension runtime integration.'.split(
              ' ',
            );
          let index = 0;

          const intervalId = window.setInterval(() => {
            if (isDisconnected) {
              window.clearInterval(intervalId);
              return;
            }

            if (index >= words.length) {
              for (const listener of messageListeners.values()) {
                listener({
                  type: 'CHAT_STREAM_DONE',
                  requestId,
                });
              }
              window.clearInterval(intervalId);
              return;
            }

            const chunk = `${words[index]} `;
            for (const listener of messageListeners.values()) {
              listener({
                type: 'CHAT_STREAM_CHUNK',
                requestId,
                chunk,
              });
            }

            index += 1;
          }, 60);
        };

        return {
          onMessage: {
            addListener(listener: (message: unknown) => void) {
              messageListeners.addListener(listener);
            },
            removeListener(listener: (message: unknown) => void) {
              messageListeners.removeListener(listener);
            },
          },
          postMessage(message: unknown) {
            const typed = message as { type?: string; requestId?: string };
            if (typed.type === 'CHAT_STREAM_START' && typeof typed.requestId === 'string') {
              sendChunkedResponse(typed.requestId);
            }
          },
          disconnect() {
            isDisconnected = true;
          },
        };
      },
    },

    storage: {
      local: storageLocal,
      session: storageSession,
    },
  };

  (globalThis as { chrome?: unknown }).chrome = chromeShim;
}

installChromePreviewShim();
