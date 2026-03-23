import { useState } from 'react';

import type { ChatModel } from '../../lib/ai';
import type { ChatModelId } from '../../types/chat';

type ChatInputProps = {
  isSending: boolean;
  onSend: (value: string) => void;
  modelId: ChatModelId;
  models: ChatModel[];
  onModelChange: (modelId: ChatModelId) => void;
};

export function ChatInput({ isSending, onSend, modelId, models, onModelChange }: ChatInputProps) {
  const [value, setValue] = useState('');

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    onSend(trimmed);
    setValue('');
  };

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
          aria-label="Chat message input"
        />
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
