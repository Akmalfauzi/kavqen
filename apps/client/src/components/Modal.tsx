'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { RiCloseLine } from 'react-icons/ri';

export default function Modal({ title, subtitle, footer, onClose, children }: { title: string; subtitle?: string; footer?: ReactNode; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, []);

  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    } }}
    className="fixed left-1/2 top-1/2 right-auto bottom-auto m-0 -translate-x-1/2 -translate-y-1/2 w-[calc(100%_-_2rem)] max-w-2xl max-h-[85dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm">
    <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-100 bg-white p-5 sm:p-6">
      <div className="min-w-0">
        {subtitle && <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-indigo-600">{subtitle}</p>}
        <h2 id={titleId} className="text-lg font-bold text-slate-900 break-words">{title}</h2>
      </div>
      <button autoFocus type="button" onClick={onClose} aria-label="Close dialog" className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-indigo-500"><RiCloseLine className="h-5 w-5" /></button>
    </div>
    <div className="p-5 sm:p-6">{children}</div>
    {footer && <div className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">{footer}</div>}
  </dialog>;
}
