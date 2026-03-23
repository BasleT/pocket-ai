import { Mic, MicOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { ChatModel } from '../../lib/ai';
import type { ChatModelId } from '../../types/chat';

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function resolveSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const speechRecognition =
    (window as Window & { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ??
    (window as Window & { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;

  return speechRecognition ?? null;
}

type ChatInputProps = {
  isSending: boolean;
  onSend: (value: string) => void;
  modelId: ChatModelId;
  models: ChatModel[];
  onModelChange: (modelId: ChatModelId) => void;
};

export function ChatInput({ isSending, onSend, modelId, models, onModelChange }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    onSend(trimmed);
    setValue('');
    setInterimTranscript('');
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognitionCtor = resolveSpeechRecognitionCtor();

    if (!SpeechRecognitionCtor) {
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setInterimTranscript('');
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join('');

      setValue(transcript);

      const latestResult = event.results[event.results.length - 1];
      if (latestResult?.isFinal) {
        setInterimTranscript('');
        setValue(transcript);
        window.setTimeout(() => submit(), 0);
      } else {
        setInterimTranscript(transcript);
      }
    };

    recognition.start();
  };

  const supportsVoice = Boolean(resolveSpeechRecognitionCtor());

  return (
    <div className="ui-input-bar">
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor="chat-model" className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Model
        </label>
        <select
          id="chat-model"
          value={modelId}
          onChange={(event) => onModelChange(event.target.value as ChatModelId)}
          className="cursor-pointer border-0 bg-transparent text-xs transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder="Ask about this page..."
          className="ui-input max-h-40 min-h-[42px] w-full resize-none"
          style={{ color: interimTranscript ? 'var(--text-secondary)' : 'var(--text-primary)' }}
          aria-label="Chat message input"
        />
        {supportsVoice ? (
          <button
            type="button"
            onClick={toggleVoiceInput}
            className={`ui-btn ui-btn-ghost h-10 w-10 shrink-0 !p-0 ${isListening ? 'mic-listening' : ''}`}
            aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
            title={isListening ? 'Listening...' : 'Voice input'}
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        ) : null}
        <button
          type="button"
          onClick={submit}
          disabled={isSending || !value.trim()}
          className="ui-btn ui-btn-accent h-10 shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}
