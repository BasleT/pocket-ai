type ContextBarProps = {
  title: string;
  source: 'readability' | 'fallback';
  warning?: string;
};

export function ContextBar({ title, source, warning }: ContextBarProps) {
  return (
    <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs font-medium text-slate-700 dark:text-slate-200">📄 Reading: {title}</p>
      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Source: {source}</p>
      {warning ? <p className="mt-1 text-[11px] text-amber-700">{warning}</p> : null}
    </div>
  );
}
