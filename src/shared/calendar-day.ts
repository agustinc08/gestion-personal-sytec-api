export type CalendarDayStatus = 'LEAVE' | 'STRIKE' | 'WEEKEND' | 'REMOTE' | 'PRESENTIAL' | 'UNKNOWN';

export function resolveEmployeeCalendarDay(input: {
  date: string;
  today: string;
  approvedLeave: boolean;
  strike: boolean;
  remoteDays: string[];
  workLogMode?: string;
  workLogLoaded: boolean;
}) {
  const weekday = new Date(`${input.date}T12:00:00Z`).getUTCDay();
  const weekend = weekday === 0 || weekday === 6;
  const historical = input.date < input.today;
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  let status: CalendarDayStatus;
  if (input.approvedLeave) status = 'LEAVE';
  else if (input.strike) status = 'STRIKE';
  else if (weekend) status = 'WEEKEND';
  else if (historical) status = input.workLogMode === 'remoto' ? 'REMOTE' : input.workLogMode === 'presencial' ? 'PRESENTIAL' : 'UNKNOWN';
  else status = input.remoteDays.some((day) => day.trim().toLocaleLowerCase('es') === dayNames[weekday].toLocaleLowerCase('es')) ? 'REMOTE' : 'PRESENTIAL';
  const collision = input.workLogLoaded && (input.approvedLeave || input.strike || weekend);
  const workLogPending = !input.workLogLoaded && !input.approvedLeave && !input.strike && !weekend;
  return { status, collision, workLogPending };
}
