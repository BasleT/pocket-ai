export type PageContentResult = {
  title: string;
  url: string;
  content: string;
  excerpt?: string;
  selection?: string;
  source: 'readability' | 'dom' | 'body' | 'unsupported' | 'fallback';
  warning?: string;
};

export type GetPageContentMessage = {
  type: 'GET_PAGE_CONTENT';
};

export type RequestPageContentSnapshotMessage = {
  type: 'REQUEST_PAGE_CONTENT_SNAPSHOT';
};

export type PageContentMessage = {
  type: 'PAGE_CONTENT';
  payload: PageContentResult;
};

export type PageContentUpdatedMessage = {
  type: 'PAGE_CONTENT_UPDATED';
  tabId: number;
  page: PageContentResult;
};

export type GetPageContentResponse =
  | {
      ok: true;
      page: PageContentResult;
    }
  | {
      ok: false;
      message: string;
    };
