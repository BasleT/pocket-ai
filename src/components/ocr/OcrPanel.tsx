import { useEffect, useState } from 'react';

import type { GetPageImagesResponse, OcrResult, OcrUpdatedMessage } from '../../types/ocr';

type OcrPanelProps = {
  onSendToChat: (text: string) => void;
};

export function OcrPanel({ onSendToChat }: OcrPanelProps) {
  const [images, setImages] = useState<string[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [extractingImageUrl, setExtractingImageUrl] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);

  const loadImages = async () => {
    setIsLoadingImages(true);
    try {
      const response = (await chrome.runtime.sendMessage({ type: 'GET_PAGE_IMAGES' })) as GetPageImagesResponse;
      setImages(response.ok ? response.images : []);
    } catch {
      setImages([]);
    } finally {
      setIsLoadingImages(false);
    }
  };

  useEffect(() => {
    const onRuntimeMessage = (message: OcrUpdatedMessage) => {
      if (!message || message.type !== 'OCR_RESULT_UPDATED') {
        return;
      }

      setOcrResult(message.result);
      setExtractingImageUrl(null);
    };

    void loadImages();
    chrome.runtime.onMessage.addListener(onRuntimeMessage);
    return () => chrome.runtime.onMessage.removeListener(onRuntimeMessage);
  }, []);

  const runOcr = async (imageUrl: string) => {
    setExtractingImageUrl(imageUrl);
    await chrome.runtime.sendMessage({ type: 'RUN_OCR_ON_IMAGE', imageUrl });
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Select an image from this page to extract text.</p>
        <button
          type="button"
          onClick={() => {
            void loadImages();
          }}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
        >
          Refresh
        </button>
      </div>

      {isLoadingImages ? <p className="mt-3 text-xs text-slate-500">Loading images...</p> : null}

      {!isLoadingImages && images.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No images detected on the current page.</p>
      ) : null}

      {images.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2 overflow-y-auto">
          {images.map((imageUrl) => (
            <button
              key={imageUrl}
              type="button"
              onClick={() => {
                void runOcr(imageUrl);
              }}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white text-left"
            >
              <img src={imageUrl} alt="Page preview" className="h-20 w-full object-cover" />
              <p className="truncate px-2 py-1 text-[10px] text-slate-500">
                {extractingImageUrl === imageUrl ? 'Extracting...' : imageUrl}
              </p>
            </button>
          ))}
        </div>
      ) : null}

      {ocrResult ? (
        <div className="mt-3 min-h-0 flex-1 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Extracted text</p>
          <article className="mt-2 max-h-36 overflow-y-auto whitespace-pre-wrap text-xs text-slate-700">
            {ocrResult.error ? `Error: ${ocrResult.error}` : ocrResult.text || 'No text extracted.'}
          </article>
          {!ocrResult.error && ocrResult.text ? (
            <button
              type="button"
              onClick={() => onSendToChat(`Use this OCR text as context:\n\n${ocrResult.text}`)}
              className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
            >
              Send to chat
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
