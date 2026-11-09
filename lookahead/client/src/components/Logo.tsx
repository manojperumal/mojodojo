export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect width="32" height="32" rx="6" fill={dark ? '#0f172a' : '#1e293b'} />
        <path d="M7 22h6M7 16h12M7 10h18" stroke="#e8a317" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className={dark ? 'font-bold text-ink-900' : 'font-bold'}>Lookahead</span>
    </span>
  );
}
