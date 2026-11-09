import clsx from 'clsx';
import { X, Check, AlertTriangle, CircleAlert, Loader2 } from 'lucide-react';
import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { READINESS_LABELS, STATUS_LABELS, type ConstraintStatus, type Readiness } from '@lookahead/shared';

export { clsx };

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
export function Button({ variant = 'secondary', size = 'md', className, loading, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  return (
    <button
      {...p}
      disabled={p.disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap',
        size === 'sm' && 'h-8 px-2.5 text-sm',
        size === 'md' && 'h-9 px-3.5 text-sm',
        size === 'lg' && 'h-12 px-5 text-base',
        variant === 'primary' && 'bg-brand-500 text-ink-900 hover:bg-brand-400 shadow-sm',
        variant === 'secondary' && 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
        variant === 'ghost' && 'text-slate-700 hover:bg-slate-100',
        variant === 'danger' && 'bg-risk-600 text-white hover:bg-risk-700',
        variant === 'dark' && 'bg-ink-900 text-white hover:bg-ink-800',
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

const field = 'w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:bg-slate-100 disabled:text-slate-500';
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={clsx(field, 'h-9', className)} />;
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={clsx(field, 'py-2', className)} />;
export const Select = ({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={clsx(field, 'h-9 pr-8', className)}>
    {children}
  </select>
);

export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-risk-700">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

const READY_STYLE: Record<Readiness, string> = {
  ready: 'bg-ready-50 text-ready-700 border-ready-600/40',
  constrained: 'bg-constrained-50 text-constrained-700 border-constrained-600/40',
  at_risk: 'bg-risk-50 text-risk-700 border-risk-600/50',
};
const READY_ICON: Record<Readiness, typeof Check> = { ready: Check, constrained: CircleAlert, at_risk: AlertTriangle };

/** Readiness never relies on colour alone: icon + label (FR-12). */
export function ReadinessBadge({ state, size = 'sm', overridden }: { state: Readiness; size?: 'sm' | 'lg'; overridden?: boolean }) {
  const Icon = READY_ICON[state];
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded border font-bold tracking-wide whitespace-nowrap', READY_STYLE[state], size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2.5 py-1 text-sm')}>
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} strokeWidth={2.5} />
      {READINESS_LABELS[state]}
      {overridden && <span title="Super override" className="font-normal">*</span>}
    </span>
  );
}

const STATUS_STYLE: Record<ConstraintStatus, string> = {
  raised: 'bg-risk-50 text-risk-700 border-risk-600/40',
  open: 'bg-white text-slate-700 border-slate-300',
  promised: 'bg-sky-50 text-sky-800 border-sky-300',
  cleared: 'bg-ready-50 text-ready-700 border-ready-600/30',
  missed: 'bg-risk-600 text-white border-risk-700',
};
export function StatusBadge({ status }: { status: ConstraintStatus }) {
  return <span className={clsx('inline-flex rounded border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide', STATUS_STYLE[status])}>{status === 'raised' ? 'Raised · needs owner' : STATUS_LABELS[status]}</span>;
}

export function Badge({ children, tone = 'slate', className }: { children: ReactNode; tone?: 'slate' | 'amber' | 'red' | 'green' | 'blue' | 'dark'; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold',
        tone === 'slate' && 'bg-slate-100 text-slate-700',
        tone === 'amber' && 'bg-brand-100 text-brand-700',
        tone === 'red' && 'bg-risk-100 text-risk-700',
        tone === 'green' && 'bg-ready-100 text-ready-700',
        tone === 'blue' && 'bg-sky-100 text-sky-800',
        tone === 'dark' && 'bg-ink-900 text-white',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ title, actions, children, className, bodyClass }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={clsx('rounded-lg border border-slate-200 bg-white shadow-sm', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={clsx('p-4', bodyClass)}>{children}</div>
    </section>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export const Spinner = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="flex items-center gap-2 p-8 text-slate-500">
    <Loader2 className="h-5 w-5 animate-spin" /> {label}
  </div>
);

function useEsc(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

export function Drawer({ open, onClose, title, subtitle, children, width = 'max-w-2xl' }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; width?: string }) {
  useEsc(onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end print:hidden">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <aside className={clsx('relative flex h-full w-full flex-col bg-white shadow-2xl', width)} role="dialog" aria-modal>
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight text-slate-900">{title}</h2>
            {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}

export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEsc(onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
      <div className="absolute inset-0 bg-ink-900/50" onClick={onClose} />
      <div className={clsx('relative w-full rounded-lg bg-white shadow-2xl', width)} role="dialog" aria-modal>
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={clsx('rounded px-3 py-1 text-sm font-medium', value === t.value ? 'bg-ink-900 text-white' : 'text-slate-600 hover:bg-slate-100')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Toasts ----------
type ToastItem = { id: number; text: string; kind: 'ok' | 'error' };
let push: ((t: ToastItem) => void) | null = null;
let seq = 0;
export function toast(text: string, kind: 'ok' | 'error' = 'ok') {
  push?.({ id: ++seq, text, kind });
}
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    push = (t) => {
      setItems((xs) => [...xs, t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), t.kind === 'error' ? 6000 : 3000);
    };
    return () => {
      push = null;
    };
  }, []);
  return createPortal(
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2 print:hidden" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={clsx('rounded-md px-4 py-2.5 text-sm font-medium shadow-lg', t.kind === 'error' ? 'bg-risk-700 text-white' : 'bg-ink-900 text-white')}>
          {t.text}
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={clsx('mt-1 text-3xl font-bold tabular-nums', tone === 'good' && 'text-ready-700', tone === 'bad' && 'text-risk-700', tone === 'warn' && 'text-constrained-700')}>{value}</div>
      {sub && <div className="mt-1 text-sm text-slate-500">{sub}</div>}
    </div>
  );
}
