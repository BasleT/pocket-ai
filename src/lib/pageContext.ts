import { useEffect, useState } from 'react';

import {
  ACTIVE_PAGE_TAB_ID_KEY,
  buildFallbackPageContext,
  createPageContextStorageKey,
  createPreviousPageContextStorageKey,
} from './pageContextStore';
import type { PageContentResult, PageContentUpdatedMessage } from '../types/page';

type UsePageContextState = {
  page: PageContentResult | null;
  previousPage: PageContentResult | null;
  loading: boolean;
  error: string | null;
};

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function loadStoredPageContext(): Promise<{ page: PageContentResult; previousPage: PageContentResult | null }> {
  const activeTabId = await getActiveTabId();
  if (!activeTabId) {
    return {
      page: buildFallbackPageContext(''),
      previousPage: null,
    };
  }

  const storageKey = createPageContextStorageKey(activeTabId);
  const previousStorageKey = createPreviousPageContextStorageKey(activeTabId);
  const stored = await chrome.storage.session.get([ACTIVE_PAGE_TAB_ID_KEY, storageKey, previousStorageKey]);
  const page = stored[storageKey] as PageContentResult | undefined;
  const previousPage = stored[previousStorageKey] as PageContentResult | undefined;

  if (page) {
    return {
      page,
      previousPage: previousPage ?? null,
    };
  }

  return {
    page: buildFallbackPageContext(''),
    previousPage: null,
  };
}

export function usePageContext(): UsePageContextState {
  const [state, setState] = useState<UsePageContextState>({
    page: null,
    previousPage: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const refresh = async () => {
      try {
        const context = await loadStoredPageContext();
        if (!isMounted) {
          return;
        }

        setState({
          page: context.page,
          previousPage: context.previousPage,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setState({
          page: null,
          previousPage: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load page context.',
        });
      }
    };

    const onRuntimeMessage = (message: PageContentUpdatedMessage) => {
      if (!message || message.type !== 'PAGE_CONTENT_UPDATED') {
        return;
      }

      void refresh();
    };

    const onStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== 'session') {
        return;
      }

      if (!changes[ACTIVE_PAGE_TAB_ID_KEY]) {
        return;
      }

      void refresh();
    };

    const onTabActivated = () => {
      void refresh();
    };

    void refresh();

    chrome.runtime.onMessage.addListener(onRuntimeMessage);
    chrome.storage.onChanged.addListener(onStorageChange);
    chrome.tabs.onActivated.addListener(onTabActivated);

    return () => {
      isMounted = false;
      chrome.runtime.onMessage.removeListener(onRuntimeMessage);
      chrome.storage.onChanged.removeListener(onStorageChange);
      chrome.tabs.onActivated.removeListener(onTabActivated);
    };
  }, []);

  return state;
}
