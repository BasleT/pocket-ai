import type { ChatModel } from '../../lib/ai';
import type { ChatModelId } from '../../types/chat';

type ModelPickerProps = {
  value: ChatModelId;
  models: ChatModel[];
  onChange: (modelId: ChatModelId) => void;
};

export function ModelPicker({ value, models, onChange }: ModelPickerProps) {
  const hasModels = models.length > 0;

  return (
    <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
      <span className="font-medium">Model</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as ChatModelId)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
        aria-label="Choose chat model"
        disabled={!hasModels}
      >
        {hasModels ? (
          models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} ({model.provider})
            </option>
          ))
        ) : (
          <option value="">No API models configured</option>
        )}
      </select>
    </label>
  );
}
