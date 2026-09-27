'use client';

import { useId, useState } from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine, RiCalendarLine } from 'react-icons/ri';
import Modal from './Modal';

const keyFor = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fromKey = (value: string) => new Date(`${value}T12:00:00`);

export default function DatePicker({ label, value, onChange, min, max, invalid, describedBy }: {
  label: string; value: string; onChange: (value: string) => void;
  min?: string; max?: string; invalid?: boolean; describedBy?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const allowed = (key: string) => (!min || key >= min) && (!max || key <= max);
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12);
  const today = keyFor(new Date());
  const choose = (key: string) => { onChange(key); setOpen(false); };
  const days = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - first.getDay() + 1, 12));

  return <div className="flex-1 min-w-[150px]">
    <label htmlFor={id} className="text-xs font-semibold text-slate-600">{label}</label>
    <button id={id} type="button" aria-haspopup="dialog" aria-expanded={open} aria-invalid={invalid} aria-describedby={describedBy}
      onClick={() => {
        const initial = value || (min && today < min ? min : max && today > max ? max : today);
        setMonth(fromKey(initial)); setOpen(true);
      }}
      className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
      <span className={value ? '' : 'text-slate-400'}>{value ? fromKey(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select date'}</span>
      <RiCalendarLine aria-hidden="true" className="h-4 w-4 text-slate-400" />
    </button>
    {open && <Modal title={label} subtitle="Select a date" onClose={() => setOpen(false)} footer={<div className="flex justify-between">
      <button type="button" onClick={() => choose('')} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Clear date</button>
      <button type="button" disabled={!allowed(today)} onClick={() => choose(today)} className="rounded-lg px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-40">Today</button>
    </div>}>
      <div className="mx-auto max-w-sm">
        <div className="mb-5 flex items-center justify-between">
          <button type="button" aria-label="Previous month" disabled={Boolean(min && keyFor(first) <= min)} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))} className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-30"><RiArrowLeftSLine className="h-5 w-5" /></button>
          <p aria-live="polite" className="text-sm font-semibold text-slate-900">{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
          <button type="button" aria-label="Next month" disabled={Boolean(max && keyFor(last) >= max)} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))} className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-30"><RiArrowRightSLine className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day} className="pb-2 text-center text-xs font-medium text-slate-400">{day}</span>)}
          {days.map(date => {
            const key = keyFor(date);
            return <button key={key} type="button" disabled={!allowed(key)} aria-pressed={value === key} aria-current={today === key ? 'date' : undefined}
              aria-label={date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              onClick={() => choose(key)} className={`aspect-square rounded-xl text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-25 disabled:cursor-not-allowed ${value === key ? 'bg-indigo-600 font-semibold text-white' : `${date.getMonth() === month.getMonth() ? 'text-slate-700' : 'text-slate-400'} hover:bg-indigo-50 ${today === key ? 'ring-1 ring-inset ring-indigo-300 font-semibold' : ''}`}`}>
              {date.getDate()}
            </button>;
          })}
        </div>
      </div>
    </Modal>}
  </div>;
}
