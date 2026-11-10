import { diffDays, parseISO, type ISODate } from '@lookahead/shared';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function fmtDate(d: ISODate | null | undefined, withDow = false) {
  if (!d) return '—';
  const x = parseISO(d);
  return `${withDow ? DOW[x.getUTCDay()] + ' ' : ''}${MON[x.getUTCMonth()]} ${x.getUTCDate()}`;
}

export function fmtRange(a: ISODate, b: ISODate) {
  return a === b ? fmtDate(a) : `${fmtDate(a)} – ${fmtDate(b)}`;
}

export function relDays(d: ISODate | null | undefined, today: ISODate) {
  if (!d) return '';
  const n = diffDays(today, d);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n}d` : `${-n}d ago`;
}

export function timeAgo(ts: string | null | undefined) {
  if (!ts) return '—';
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export const pct = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(x * 100)}%`);

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
