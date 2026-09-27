'use client';

import React, { useEffect, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { validateVoiceField } from '@/lib/voice-field';
import ParticipantVoiceAgent from '@/components/ParticipantVoiceAgent';
import { api, getToken } from '@/lib/api';

interface FormField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  prompt_hint?: string | null;
  options?: string[];
}

interface SharedForm {
  id: string;
  name: string;
  description: string | null;
  fields: FormField[];
}

export default function SharedFormPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<SharedForm | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receiptId, setReceiptId] = useState('');
  const valuesRef = useRef(values);
  const submittingRef = useRef(false);
  const receiptRef = useRef('');
  const updateValues = (update: (current: Record<string, string>) => Record<string, string>) => {
    valuesRef.current = update(valuesRef.current); setValues(valuesRef.current);
  };
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    api.get(`/share/forms/${id}`)
      .then((response) => {
        setForm(response.data.data);
        const saved = response.data.data.submission;
        if (saved) { receiptRef.current = saved.id; setReceiptId(saved.id); valuesRef.current = saved.data; setValues(saved.data); }
      })
      .catch((err) => {
        if (err.response?.status === 401) router.replace('/login');
        else setError(err.response?.data?.message || 'Form unavailable');
      });
  }, [id, router]);

  const submit = async () => {
    if (receiptRef.current) return { success: true, message: 'This form has already been submitted. No duplicate was created.' };
    if (submittingRef.current) return { success: false, message: 'Submission is processing. Please wait.' };
    if (!form) return { success: false, message: 'Form unavailable.' };
    const values = { ...valuesRef.current };
    const errors: Record<string, string> = {};
    for (const field of form?.fields || []) {
      if (field.required && !values[field.name]?.trim()) errors[field.name] = 'This field is required.';
      else if (values[field.name]?.trim()) { const checked = validateVoiceField(field, values[field.name]); if (checked.error) errors[field.name] = checked.error; }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return { success: false, message: Object.entries(errors).map(([name, message]) => `${name}: ${message}`).join(' ') };
    submittingRef.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await api.post('/submissions', { workflowId: id, data: values });
      receiptRef.current = response.data.data.id;
      setReceiptId(response.data.data.id);
      valuesRef.current = response.data.data.data; setValues(valuesRef.current);
      toast.success(response.data.alreadySubmitted ? 'This form was already submitted.' : 'Form submitted successfully.');
      return { success: true, message: 'Form submitted successfully.' };
    } catch (err: any) {
      const message = err.response?.data?.message || 'Unable to submit the form';
      setError(message);
      return { success: false, message };
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <main className="bg-slate-50 p-4 sm:p-6">
      <Toaster position="top-center" />
      <div className="max-w-7xl mx-auto space-y-5">
        <Link href="/dashboard" className="text-sm font-semibold text-indigo-700">← Dashboard</Link>
        {error && <p className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">{error}</p>}
        {!form && !error && <p className="text-sm text-slate-500">Loading form...</p>}
        {receiptId && <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <h1 className="font-bold text-emerald-900">Form submitted successfully</h1>
          <p className="text-sm text-emerald-800 mt-1">Receipt ID: {receiptId}</p>
        </div>}
        {form && <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {<ParticipantVoiceAgent key={id} workflowId={id} values={values} fields={form.fields} submitted={!!receiptId} onField={(name, value) => { if (receiptRef.current || submittingRef.current) return; updateValues(current => ({ ...current, [name]: value })); setFieldErrors(current => ({ ...current, [name]: '' })); }} onSubmit={submit} />}
          <form noValidate onSubmit={event => { event.preventDefault(); void submit(); }} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          {busy && <p role="status" className="text-sm text-slate-500">Submitting your answers...</p>}
          <fieldset disabled={busy || !!receiptId} className="space-y-5 disabled:opacity-70">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{form.name}</h1>
            {form.description && <p className="text-sm text-slate-600 mt-1">{form.description}</p>}
          </div>
          <p className="text-sm text-slate-500">Your answers are filled during the conversation. Review them here, then say "submit the form" or use the button below.</p>
          {form.fields.length === 0 && <p className="text-sm text-rose-600">This form has no fields. Contact its owner.</p>}
          {form.fields.map((field) => <label key={field.name} className="block text-sm font-semibold text-slate-800">
            {field.label || field.name}{field.required && <span className="text-rose-600"> *</span>}
            {field.type === 'boolean' ? <select
              value={values[field.name] || ''} aria-required={field.required} aria-invalid={!!fieldErrors[field.name]} aria-describedby={fieldErrors[field.name] ? `error-${field.name}` : undefined}
              onChange={(event) => { updateValues((current) => ({ ...current, [field.name]: event.target.value })); setFieldErrors(current => ({ ...current, [field.name]: '' })); }}
              className="block mt-1 w-full border border-slate-300 rounded-lg p-2 font-normal"
            ><option value="">Select...</option><option value="true">Yes</option><option value="false">No</option></select>
              : field.type === 'enum' && field.options?.length ? <select
              value={values[field.name] || ''} aria-required={field.required} aria-invalid={!!fieldErrors[field.name]} aria-describedby={fieldErrors[field.name] ? `error-${field.name}` : undefined}
              onChange={(event) => { updateValues((current) => ({ ...current, [field.name]: event.target.value })); setFieldErrors(current => ({ ...current, [field.name]: '' })); }}
              className="block mt-1 w-full border border-slate-300 rounded-lg p-2 font-normal"
            ><option value="">Select...</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
              : field.type === 'text' ? <textarea
                value={values[field.name] || ''} aria-required={field.required} aria-invalid={!!fieldErrors[field.name]} aria-describedby={fieldErrors[field.name] ? `error-${field.name}` : undefined}
                onChange={(event) => { updateValues((current) => ({ ...current, [field.name]: event.target.value })); setFieldErrors(current => ({ ...current, [field.name]: '' })); }}
                className="block mt-1 w-full border border-slate-300 rounded-lg p-2 font-normal" rows={3}
              /> : <input
                type={field.type === 'email' ? 'email' : field.type === 'datetime' ? 'datetime-local' : field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : field.type === 'phone' ? 'tel' : 'text'}
                value={values[field.name] || ''} aria-required={field.required} aria-invalid={!!fieldErrors[field.name]} aria-describedby={fieldErrors[field.name] ? `error-${field.name}` : undefined}
                onChange={(event) => { updateValues((current) => ({ ...current, [field.name]: event.target.value })); setFieldErrors(current => ({ ...current, [field.name]: '' })); }}
                className="block mt-1 w-full border border-slate-300 rounded-lg p-2 font-normal"
              />}
            {fieldErrors[field.name] && <span id={`error-${field.name}`} role="alert" className="block mt-1 text-xs text-red-600 font-normal">{fieldErrors[field.name]}</span>}
          </label>)}
          {!receiptId && <button disabled={busy || form.fields.length === 0} className="bg-indigo-600 text-white rounded-lg px-5 py-2 font-semibold disabled:opacity-50">
            {busy ? 'Submitting...' : 'Submit form'}
          </button>}
          </fieldset>
        </form></div>}
      </div>
    </main>
  );
}
