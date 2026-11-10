// All plan dates are calendar dates as 'YYYY-MM-DD' strings (no time zone drift).

export type ISODate = string;

export function toISO(d: Date): ISODate {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(s: ISODate): number {
  return parseISO(s).getUTCDay();
}

/** Start of the plan week containing `s`. Weeks start Monday (PRD §8: Monday roll-forward). */
export function weekStart(s: ISODate, startsOn = 1): ISODate {
  const dow = dayOfWeek(s);
  const back = (dow - startsOn + 7) % 7;
  return addDays(s, -back);
}

export function weeksInWindow(fromWeek: ISODate, weeks: number): ISODate[] {
  return Array.from({ length: weeks }, (_, i) => addDays(fromWeek, i * 7));
}

/** Today's date in a given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}

export function hourIn(timeZone: string, now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now),
  );
}

export function minDate(...ds: (ISODate | null | undefined)[]): ISODate | null {
  const xs = ds.filter(Boolean) as ISODate[];
  return xs.length ? xs.reduce((a, b) => (a < b ? a : b)) : null;
}

export function overlaps(start: ISODate, finish: ISODate, from: ISODate, to: ISODate): boolean {
  return start <= to && finish >= from;
}

export function isWorkDay(s: ISODate, workDays: number): boolean {
  const dow = dayOfWeek(s); // 0 Sun
  if (workDays >= 7) return true;
  if (workDays === 6) return dow !== 0;
  return dow !== 0 && dow !== 6;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
