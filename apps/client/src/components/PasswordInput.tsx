'use client';

import { useState, type InputHTMLAttributes } from 'react';
import { RiEyeLine, RiEyeOffLine } from 'react-icons/ri';

export default function PasswordInput({ className = '', ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return <div className="relative">
    <input {...props} type={visible ? 'text' : 'password'} className={`${className} !pr-12`} />
    <button type="button" disabled={props.disabled} aria-label={visible ? 'Hide password' : 'Show password'} aria-controls={props.id} aria-pressed={visible}
      onClick={() => setVisible(current => !current)}
      className="absolute inset-y-0 right-1 my-auto flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40">
      {visible ? <RiEyeOffLine aria-hidden="true" className="h-5 w-5" /> : <RiEyeLine aria-hidden="true" className="h-5 w-5" />}
    </button>
  </div>;
}
