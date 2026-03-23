import { useState } from 'react';

type ChatInputProps = {
  isDisabled?: boolean;
  onSend: (text: string) => void;
};

export function ChatInput({ isDisabled = false, onSend }: ChatInputProps) {
  const [value, setValue] = useState('');

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || isDisabled) {
      return;
    }

    onSend(trimmed);
    setValue('');
  };

  return (
    <div className="border-t border-slate-200 bg-white p-3">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.ctrlKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="Ask anything... (Ctrl+Enter to send)"
        className="h-24 w-full resize-none rounded-md border border-slate-300 p-2 text-sm outline-none transition focus:border-slate-500"
        disabled={isDisabled}
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={isDisabled || value.trim().length === 0}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Send
        </button>
      </div>
    </div>
  );
}
