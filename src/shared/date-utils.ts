export const ARGENTINA_TIME_ZONE = process.env.APP_TIMEZONE || 'America/Argentina/Buenos_Aires';

const ARGENTINA_UTC_OFFSET_HOURS = 3;

export function getArgentinaTodayDateOnly(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ARGENTINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + '-' + values.month + '-' + values.day;
}

export function parseDateOnlySafe(value?: string | Date | null): string {
  if (!value) return '';
  if (value instanceof Date) return formatDateOnlyArgentina(value);
  const match = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? match[0] : '';
}

export function dateOnlyToArgentinaDate(value?: string | Date | null): Date | undefined {
  const dateOnly = value instanceof Date ? formatDateOnlyArgentina(value) : parseDateOnlySafe(value);
  if (!dateOnly) return undefined;
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, ARGENTINA_UTC_OFFSET_HOURS, 0, 0, 0));
}

export function dateOnlyToArgentinaDayRange(value?: string | Date | null): { start: Date; end: Date } {
  const dateOnly = value instanceof Date ? formatDateOnlyArgentina(value) : parseDateOnlySafe(value || getArgentinaTodayDateOnly());
  const [year, month, day] = dateOnly.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, ARGENTINA_UTC_OFFSET_HOURS, 0, 0, 0));
  return { start, end };
}

export function monthRangeArgentina(yearValue?: string | number, monthValue?: string | number): { start: Date; end: Date; year: number; month: number } {
  const today = getArgentinaTodayDateOnly();
  const [currentYear, currentMonth] = today.split('-').map(Number);
  const year = Number(yearValue) || currentYear;
  const month = monthValue ? Number(monthValue) : undefined;
  const startMonth = month ? month - 1 : 0;
  const endMonth = month ? month : 12;
  const start = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, endMonth, 1, ARGENTINA_UTC_OFFSET_HOURS, 0, 0, 0));
  return { start, end, year, month: month || currentMonth };
}

export function formatDateOnlyArgentina(value?: Date | string | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return parseDateOnlySafe(String(value));
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0) {
    return date.toISOString().slice(0, 10);
  }
  return getArgentinaTodayDateOnly(date);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

export function argentinaYear(): number {
  return Number(getArgentinaTodayDateOnly().slice(0, 4));
}
