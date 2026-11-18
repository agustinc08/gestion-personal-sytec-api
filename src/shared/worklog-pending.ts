import { formatDateOnlyArgentina } from './date-utils';
import { getWorkdayStatus, requiresWorkLog } from './workday';

export function pendingWorkLogEmployeeIds(input: {
  date: string;
  strikeDate?: Date | string | null;
  employees: Array<{ id: string; remoteDays: string[] }>;
  employeeIdsWithLogs: Iterable<string>;
  employeeIdsOnApprovedLeave: Iterable<string>;
}) {
  const logged = new Set(input.employeeIdsWithLogs);
  const onLeave = new Set(input.employeeIdsOnApprovedLeave);
  return input.employees
    .filter((employee) => {
      const status = getWorkdayStatus({ date: input.date, remoteDays: employee.remoteDays, strikeDate: input.strikeDate });
      return requiresWorkLog(status) && !logged.has(employee.id) && !onLeave.has(employee.id);
    })
    .map((employee) => employee.id);
}

export function approvedLeaveEmployeeIdsForDate<T extends { employeeId: string; startDate: Date; endDate: Date; article?: string }>(rows: T[], date: Date) {
  const dateKey = formatDateOnlyArgentina(date);
  return rows.filter((row) => row.article !== 'Guardia en Feria' && formatDateOnlyArgentina(row.startDate) <= dateKey && formatDateOnlyArgentina(row.endDate) >= dateKey).map((row) => row.employeeId);
}
