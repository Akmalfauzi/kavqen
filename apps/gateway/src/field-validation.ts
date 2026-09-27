const FIELD_TYPES = new Set(['string', 'text', 'number', 'date', 'phone', 'email', 'enum', 'boolean']);
const ALLOWED_KEYS = new Set(['name', 'label', 'type', 'required', 'prompt_hint', 'options', 'category', 'description']);

export interface FieldInput {
  name: string;
  label: string;
  type: string;
  required: boolean;
  prompt_hint: string | null;
  options: string[];
  category: string | null;
  description: string | null;
}

export function validateFieldInput(body: unknown): { data?: FieldInput; error?: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Field data must be an object' };
  const input = body as Record<string, unknown>;
  const unknown = Object.keys(input).find((key) => !ALLOWED_KEYS.has(key));
  if (unknown) return { error: `Unknown field property: ${unknown}` };

  if (typeof input.name !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(input.name)) {
    return { error: 'Field name must start with a lowercase letter and contain only lowercase letters, numbers, or underscores (max 64)' };
  }
  if (typeof input.label !== 'string' || !input.label.trim() || input.label.trim().length > 120) {
    return { error: 'Field label is required (max 120 characters)' };
  }
  if (typeof input.type !== 'string' || !FIELD_TYPES.has(input.type)) return { error: 'Unsupported field type' };
  if (typeof input.required !== 'boolean') return { error: 'Field required must be boolean' };

  for (const key of ['prompt_hint', 'category', 'description'] as const) {
    const value = input[key];
    if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > 1000)) {
      return { error: `${key} must be text (max 1000 characters)` };
    }
  }
  const rawOptions = input.options ?? [];
  if (!Array.isArray(rawOptions) || rawOptions.some((option) => typeof option !== 'string' || !option.trim() || option.length > 120)) {
    return { error: 'Options must be nonempty text (max 120 characters each)' };
  }
  const options = rawOptions.map((option: string) => option.trim());
  if (options.length > 100 || new Set(options).size !== options.length) {
    return { error: 'Options must be unique (max 100)' };
  }
  if (input.type === 'enum' && options.length === 0) return { error: 'Enum field needs at least one option' };
  if (input.type !== 'enum' && options.length > 0) return { error: 'Only enum fields can have options' };

  const optional = (key: 'prompt_hint' | 'category' | 'description') =>
    typeof input[key] === 'string' ? input[key].trim() || null : null;
  return { data: {
    name: input.name,
    label: input.label.trim(),
    type: input.type,
    required: input.required,
    prompt_hint: optional('prompt_hint'),
    options,
    category: optional('category'),
    description: optional('description')
  } };
}
