import { formatDateOnlyArgentina, getArgentinaTodayDateOnly } from './date-utils';

export type WorkdayStatus = 'WEEKEND' | 'STRIKE' | 'REMOTE' | 'PRESENTIAL';

export function currentRemoteDays(rows: Array<{ day: string; date: Date | string | null }>) {
  return [...new Set(rows.filter((row) => row.date == null).map((row) => row.day.trim()).filter(Boolean))].sort();
}

export function normalizeRemoteDays(days: string[]) {
  return [...new Set(days.map((day) => day.trim()).filter(Boolean))].sort();
}

export function getWorkdayStatus(input: { date?: Date | string; remoteDays?: string[]; strikeDate?: Date | string | null }): WorkdayStatus {
  const key = input.date ? formatDateOnlyArgentina(input.date) : getArgentinaTodayDateOnly();
  const [year, month, day] = key.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  if (input.strikeDate && formatDateOnlyArgentina(input.strikeDate) === key) return 'STRIKE';
  if (weekday === 0 || weekday === 6) return 'WEEKEND';
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return (input.remoteDays || []).some((value) => value.toLocaleLowerCase('es').trim() === days[weekday].toLocaleLowerCase('es')) ? 'REMOTE' : 'PRESENTIAL';
}

export function requiresWorkLog(status: WorkdayStatus) {
  return status === 'REMOTE' || status === 'PRESENTIAL';
}
