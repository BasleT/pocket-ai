import { useState } from 'react';

type ChatInputProps = {
  isSending: boolean;
  onSend: (value: string) => void;
};

export function ChatInput({ isSending, onSend }: ChatInputProps) {
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
    <div className="border-t border-slate-200 bg-white p-3">
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
          className="max-h-36 min-h-[38px] w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          aria-label="Chat message input"
        />
        <button
          type="button"
          onClick={submit}
          disabled={isSending || !value.trim()}
          className="h-9 shrink-0 rounded-lg bg-accent px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
