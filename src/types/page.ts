export type PageContentResult = {
  title: string;
  url: string;
  content: string;
  excerpt?: string;
  selection?: string;
  source: 'readability' | 'fallback';
  warning?: string;
};

export type GetPageContentMessage = {
  type: 'GET_PAGE_CONTENT';
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
