export type GetYouTubeVideoInfoMessage = {
  type: 'GET_YOUTUBE_VIDEO_INFO';
};

export type GetYouTubeVideoInfoResponse = {
  isYouTubePage: boolean;
  videoId: string | null;
  url: string;
  title: string;
};

export type GetYouTubeContextMessage = {
  type: 'GET_YOUTUBE_CONTEXT';
};

export type YouTubeContextData = {
  isYouTubePage: boolean;
  hasTranscript: boolean;
  title: string;
  url: string;
  videoId: string | null;
  transcriptChunks: string[];
};

export type GetYouTubeContextResponse =
  | {
      ok: true;
      data: YouTubeContextData;
    }
  | {
      ok: false;
      message: string;
    };
