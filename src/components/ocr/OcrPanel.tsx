import { useEffect, useState } from 'react';

import { ScanText } from 'lucide-react';

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
        <p className="text-xs ui-subtle">Select an image from this page to extract text.</p>
        <button
          type="button"
          onClick={() => {
            void loadImages();
          }}
          className="ui-btn ui-btn-ghost !px-2 !py-1"
        >
          Refresh
        </button>
      </div>

      {isLoadingImages ? <p className="mt-3 text-xs ui-subtle">Loading images...</p> : null}

      {!isLoadingImages && images.length === 0 ? (
        <div className="ui-empty mt-3">
          <ScanText size={32} className="ui-muted" />
          <p className="text-xs ui-subtle">No images detected on the current page.</p>
        </div>
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
              className="ui-card cursor-pointer overflow-hidden text-left transition-all duration-150 hover:scale-[1.01]"
            >
              <img src={imageUrl} alt="Page preview" className="h-20 w-full object-cover" />
              <p className="truncate px-2 py-1 text-[10px] ui-subtle">
                {extractingImageUrl === imageUrl ? 'Extracting...' : imageUrl}
              </p>
            </button>
          ))}
        </div>
      ) : null}

      {ocrResult ? (
        <div className="ui-card mt-3 min-h-0 flex-1 p-3">
          <p className="text-xs ui-subtle">Extracted text</p>
          <article className="mt-2 max-h-36 overflow-y-auto whitespace-pre-wrap text-xs" style={{ color: 'var(--text-primary)' }}>
            {ocrResult.error ? `Error: ${ocrResult.error}` : ocrResult.text || 'No text extracted.'}
          </article>
          {!ocrResult.error && ocrResult.text ? (
            <button
              type="button"
              onClick={() => onSendToChat(`Use this OCR text as context:\n\n${ocrResult.text}`)}
              className="ui-btn ui-btn-ghost mt-3"
            >
              Send to chat
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
