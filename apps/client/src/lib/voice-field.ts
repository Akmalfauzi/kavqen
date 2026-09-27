export interface VoiceField { name: string; label?: string; type: string; required?: boolean; options?: string[] }

export function validateVoiceField(field: VoiceField, raw: unknown): { value?: string; error?: string } {
  if (!['string', 'number', 'boolean'].includes(typeof raw)) return { error: 'Ask the user for a clear answer.' };
  const value = String(raw).trim();
  if (!value || value.length > 5000) return { error: 'Ask for a non-empty answer shorter than 5000 characters.' };
  if (field.type === 'enum' && !field.options?.includes(value)) return { error: `Ask the user to choose exactly one of: ${field.options?.join(', ')}.` };
  if (field.type === 'boolean' && !['true', 'false'].includes(value)) return { error: 'Confirm yes or no; save true or false.' };
  if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { error: 'Ask the user to spell the email address.' };
  if (field.type === 'phone' && (!/^\+?[\d\s().-]+$/.test(value) || value.replace(/\D/g, '').length < 9)) return { error: 'Ask for the complete phone number digit by digit. Never guess missing digits.' };
  if (field.type === 'number' && !/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return { error: 'Confirm the number before saving it.' };
  if (field.type === 'datetime') {
    const match = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? new Date(`${value}:00Z`) : null;
    if (!match || !Number.isFinite(match.getTime())) return { error: 'Clarify the day, month, year and time, then save YYYY-MM-DDTHH:mm.' };
  }
  if (field.type === 'date') {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
    if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return { error: 'Clarify day, month and year, then save YYYY-MM-DD.' };
  }
  return { value };
}
