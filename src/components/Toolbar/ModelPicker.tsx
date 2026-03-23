import { GROQ_MODELS } from '../../lib/ai';
import type { GroqModelId } from '../../types/chat';

type ModelPickerProps = {
  value: GroqModelId;
  onChange: (modelId: GroqModelId) => void;
};

export function ModelPicker({ value, onChange }: ModelPickerProps) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-slate-700">
      <span className="font-medium">Model</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as GroqModelId)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
      >
        {GROQ_MODELS.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </select>
    </label>
  );
}
