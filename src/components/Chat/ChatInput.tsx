import { useState } from 'react';

type ChatInputProps = {
  isDisabled?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  onSend: (text: string) => void;
};

export function ChatInput({ isDisabled = false, value, onChange, onSend }: ChatInputProps) {
  const [internalValue, setInternalValue] = useState('');

  const isControlled = typeof value === 'string';
  const currentValue = isControlled ? value : internalValue;

  const setValue = (nextValue: string) => {
    if (isControlled) {
      onChange?.(nextValue);
      return;
    }

    setInternalValue(nextValue);
  };

  const submit = () => {
    const trimmed = currentValue.trim();
    if (!trimmed || isDisabled) {
      return;
    }

    onSend(trimmed);
    setValue('');
  };

  return (
    <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <textarea
        value={currentValue}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.ctrlKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="Ask anything... (Ctrl+Enter to send)"
        className="h-24 w-full resize-none rounded-md border border-slate-300 p-2 text-sm outline-none transition focus:border-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        disabled={isDisabled}
        aria-label="Chat input"
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={isDisabled || currentValue.trim().length === 0}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          aria-label="Send message"
        >
          Send
        </button>
      </div>
    </div>
  );
}
