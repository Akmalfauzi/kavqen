export interface PublishedField {
  name: string;
  label?: string;
  type: string;
  required?: boolean;
  options?: string[];
}

export function validateSubmission(fields: PublishedField[], data: Record<string, unknown>) {
  const names = new Set(fields.map((field) => field.name));
  if (Object.keys(data).some((name) => !names.has(name))) {
    return { error: 'Form contains invalid fields' };
  }

  const normalized: Record<string, string> = {};
  for (const field of fields) {
    const label = field.label || field.name;
    const raw = data[field.name];
    if (raw === undefined || raw === null || raw === '') {
      if (field.required) return { error: `${label} is required` };
      continue;
    }
    if (typeof raw !== 'string') return { error: `${label} must be text` };
    const value = raw.trim();
    if (!value) {
      if (field.required) return { error: `${label} is required` };
      continue;
    }
    if (value.length > 5000) return { error: `${label} is too long (max 5000 characters)` };

    if (field.type === 'boolean' && value !== 'true' && value !== 'false') {
      return { error: `${label} must be Ya or Tidak` };
    }

    if (field.type === 'enum' && (!Array.isArray(field.options) || !field.options.includes(value))) {
      return { error: `${label} must match an available option` };
    }
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return { error: `${label} must be a valid email` };
    }
    if (field.type === 'phone' && !/^\+?[0-9][0-9\s().-]*$/.test(value)) {
      return { error: `${label} must be a valid phone number` };
    }
    if (field.type === 'phone' && value.replace(/\D/g, '').length < 9) {
      return { error: `${label} must contain at least 9 digits` };
    }
    if (field.type === 'number' && !/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) {
      return { error: `${label} must be a valid number` };
    }
    if (field.type === 'datetime') {
      // datetime-local format, no timezone: the app timezone is applied downstream.
      const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
      const parsed = match && new Date(`${value}:00.000Z`);
      if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 16) !== value) {
        return { error: `${label} must be a valid date and time (YYYY-MM-DDTHH:mm)` };
      }
    }
    if (field.type === 'date') {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      const date = match && new Date(`${value}T00:00:00.000Z`);
      if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        return { error: `${label} must be a valid date (YYYY-MM-DD)` };
      }
    }
    normalized[field.name] = value;
  }
  if (!Object.keys(normalized).length) return { error: 'Fill at least one form field' };
  return { data: normalized };
}
