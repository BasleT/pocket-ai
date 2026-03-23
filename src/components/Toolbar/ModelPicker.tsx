import type { ChatModel } from '../../lib/ai';
import type { ChatModelId } from '../../types/chat';

type ModelPickerProps = {
  value: ChatModelId;
  models: ChatModel[];
  onChange: (modelId: ChatModelId) => void;
};

export function ModelPicker({ value, models, onChange }: ModelPickerProps) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-slate-700">
      <span className="font-medium">Model</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as ChatModelId)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name} ({model.provider})
          </option>
        ))}
      </select>
    </label>
  );
}
