import { LicenseStatus, ProjectStatus, Role, WorkLogMode } from '@prisma/client';

export const toRole = (isAdmin?: boolean) => (isAdmin ? Role.ADMIN : Role.EMPLOYEE);

export function fromLicenseStatus(status: LicenseStatus) {
  return { PENDING: 'pendiente', APPROVED: 'aprobado', REJECTED: 'rechazado', CANCELLED: 'cancelado' }[status];
}

export function toLicenseStatus(status?: string) {
  return { pendiente: LicenseStatus.PENDING, aprobado: LicenseStatus.APPROVED, rechazado: LicenseStatus.REJECTED, cancelado: LicenseStatus.CANCELLED }[
    status || 'pendiente'
  ] || LicenseStatus.PENDING;
}

export function fromProjectStatus(status: ProjectStatus) {
  return { ACTIVE: 'vigente', COMPLETED: 'completado', PAUSED: 'pausado' }[status];
}

export function toProjectStatus(status?: string) {
  return { vigente: ProjectStatus.ACTIVE, completado: ProjectStatus.COMPLETED, pausado: ProjectStatus.PAUSED }[status || 'vigente'] || ProjectStatus.ACTIVE;
}

export function fromWorkLogMode(mode: WorkLogMode) {
  return { ONSITE: 'presencial', REMOTE: 'remoto', LICENSE: 'licencia' }[mode];
}

export function toWorkLogMode(mode?: string) {
  return { presencial: WorkLogMode.ONSITE, remoto: WorkLogMode.REMOTE, licencia: WorkLogMode.LICENSE }[mode || 'presencial'] || WorkLogMode.ONSITE;
}

export function dateOnly(date?: Date | string | null) {
  if (!date) return '';
  return new Date(date).toISOString().slice(0, 10);
}

export function toDate(value?: string | Date | null) {
  if (!value) return undefined;
  return new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
}

export function employeeToDto(employee: any) {
  const approved = (employee.licenseRequests || []).filter((r: any) => r.status === LicenseStatus.APPROVED);
  const sumDays = (article: string) =>
    approved
      .filter((r: any) => r.article === article)
      .reduce((acc: number, r: any) => acc + Math.max(1, Math.round((+new Date(r.endDate) - +new Date(r.startDate)) / 86400000) + 1), 0);
  return {
    id: employee.id,
    name: employee.name,
    email: employee.email || '',
    avatar: employee.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(employee.name)}&backgroundColor=cbd5e1`,
    dependency: employee.dependency,
    position: employee.position || '',
    guardiasDone: sumDays('Guardia en Feria'),
    totalLicenseDays: employee.totalLicenseDays,
    licenseDaysTaken: sumDays('Art. 14'),
    remoteDaysAssigned: (employee.remoteDays || []).map((d: any) => d.day),
    strikeDutyOrder: employee.strikeDutyOrder,
    cuil: employee.cuil || '',
    password: '',
    mustChangePassword: employee.user?.mustChangePassword || false,
    isAdmin: employee.user?.role === Role.ADMIN,
  };
}

export function projectToDto(project: any) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    requesterDependency: project.requesterDependency,
    assignedEmployeeIds: (project.assignedEmployees || []).map((e: any) => e.id),
    status: fromProjectStatus(project.status),
    updates: (project.updates || []).map((u: any) => ({
      id: u.id,
      authorName: u.authorName,
      date: new Date(u.createdAt).toISOString().slice(0, 16).replace('T', ' '),
      content: u.content,
    })),
  };
}

export function licenseToDto(req: any) {
  return {
    id: req.id,
    employeeId: req.employeeId,
    article: req.article,
    startDate: dateOnly(req.startDate),
    endDate: dateOnly(req.endDate),
    reason: req.reason,
    certificateName: req.certificateName || undefined,
    status: fromLicenseStatus(req.status),
    dateRequested: dateOnly(req.dateRequested),
  };
}

export function workLogToDto(log: any) {
  return {
    id: log.id,
    employeeId: log.employeeId,
    title: log.title,
    description: log.description,
    date: dateOnly(log.date),
    mode: fromWorkLogMode(log.mode),
  };
}
