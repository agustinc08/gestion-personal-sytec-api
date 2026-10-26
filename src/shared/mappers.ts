import { ActivityType, LicenseStatus, ProjectDifficulty, ProjectStatus, Role, WorkLogMode } from '@prisma/client';
import { dateOnlyToArgentinaDate, formatDateOnlyArgentina } from './date-utils';

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
  return {
    ACTIVE: 'vigente',
    PENDING: 'pendiente',
    IN_PROGRESS: 'en_desarrollo',
    COMPLETED: 'completado',
    FINISHED: 'terminado',
    PAUSED: 'pausado',
    IN_REVIEW: 'en_revision',
    READY_FOR_GIT: 'listo_git',
    IN_DEV_BRANCH: 'rama_dev',
    READY_FOR_DOCKER: 'listo_docker',
    DOCKERIZED: 'dockerizado',
    DEPLOYED: 'deployado',
    NEEDS_REWORK: 'necesita_rehacer',
    NEEDS_REDESIGN: 'necesita_rediseno',
    ARCHIVED: 'archivado',
  }[status];
}

export function toProjectStatus(status?: string) {
  return {
    vigente: ProjectStatus.ACTIVE,
    pendiente: ProjectStatus.PENDING,
    en_desarrollo: ProjectStatus.IN_PROGRESS,
    completado: ProjectStatus.COMPLETED,
    terminado: ProjectStatus.FINISHED,
    pausado: ProjectStatus.PAUSED,
    en_revision: ProjectStatus.IN_REVIEW,
    listo_git: ProjectStatus.READY_FOR_GIT,
    rama_dev: ProjectStatus.IN_DEV_BRANCH,
    listo_docker: ProjectStatus.READY_FOR_DOCKER,
    dockerizado: ProjectStatus.DOCKERIZED,
    deployado: ProjectStatus.DEPLOYED,
    necesita_rehacer: ProjectStatus.NEEDS_REWORK,
    necesita_rediseno: ProjectStatus.NEEDS_REDESIGN,
    archivado: ProjectStatus.ARCHIVED,
    ACTIVE: ProjectStatus.ACTIVE,
    PENDING: ProjectStatus.PENDING,
    IN_PROGRESS: ProjectStatus.IN_PROGRESS,
    COMPLETED: ProjectStatus.COMPLETED,
    FINISHED: ProjectStatus.FINISHED,
    PAUSED: ProjectStatus.PAUSED,
    IN_REVIEW: ProjectStatus.IN_REVIEW,
    READY_FOR_GIT: ProjectStatus.READY_FOR_GIT,
    IN_DEV_BRANCH: ProjectStatus.IN_DEV_BRANCH,
    READY_FOR_DOCKER: ProjectStatus.READY_FOR_DOCKER,
    DOCKERIZED: ProjectStatus.DOCKERIZED,
    DEPLOYED: ProjectStatus.DEPLOYED,
    NEEDS_REWORK: ProjectStatus.NEEDS_REWORK,
    NEEDS_REDESIGN: ProjectStatus.NEEDS_REDESIGN,
    ARCHIVED: ProjectStatus.ARCHIVED,
  }[status || 'vigente'] || ProjectStatus.ACTIVE;
}

export function toProjectDifficulty(difficulty?: string) {
  return {
    LOW: ProjectDifficulty.LOW,
    MEDIUM: ProjectDifficulty.MEDIUM,
    HIGH: ProjectDifficulty.HIGH,
    CRITICAL: ProjectDifficulty.CRITICAL,
    baja: ProjectDifficulty.LOW,
    media: ProjectDifficulty.MEDIUM,
    alta: ProjectDifficulty.HIGH,
    critica: ProjectDifficulty.CRITICAL,
  }[difficulty || 'MEDIUM'] || ProjectDifficulty.MEDIUM;
}

export function fromWorkLogMode(mode: WorkLogMode) {
  return { ONSITE: 'presencial', REMOTE: 'remoto', MIXED: 'mixto', LICENSE: 'licencia' }[mode];
}

export function toWorkLogMode(mode?: string) {
  return { presencial: WorkLogMode.ONSITE, remoto: WorkLogMode.REMOTE, mixto: WorkLogMode.MIXED, licencia: WorkLogMode.LICENSE }[mode || 'presencial'] || WorkLogMode.ONSITE;
}

export function toActivityType(activityType?: string) {
  return {
    PROJECT: ActivityType.PROJECT,
    SUPPORT: ActivityType.SUPPORT,
    MAINTENANCE: ActivityType.MAINTENANCE,
    DEPLOY: ActivityType.DEPLOY,
    MEETING: ActivityType.MEETING,
    DOCUMENTATION: ActivityType.DOCUMENTATION,
    OTHER: ActivityType.OTHER,
  }[activityType || 'PROJECT'] || ActivityType.PROJECT;
}

export function dateOnly(date?: Date | string | null) {
  return formatDateOnlyArgentina(date);
}

export function toDate(value?: string | Date | null) {
  return dateOnlyToArgentinaDate(value);
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
    dependency: employee.dependencyRef?.name || employee.dependency,
    dependencyId: employee.dependencyId || '',
    position: employee.position || '',
    guardiasDone: employee.compensatoryDays ?? sumDays('Guardia en Feria'),
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
  const updates = project.updates || [];
  const deployments = project.deployments || [];
  const lastProgress = updates.length > 0 ? updates[updates.length - 1] : null;
  const workLogs = project.workLogs || [];
  const comments = project.comments || [];
  const lastDeploy = deployments.length > 0 ? deployments[0] : null;
  const activityDates = [project.updatedAt, project.createdAt, ...updates.map((row: any) => row.createdAt), ...workLogs.map((row: any) => row.updatedAt || row.createdAt || row.date), ...deployments.map((row: any) => row.updatedAt || row.deployedAt || row.createdAt), ...comments.map((row: any) => row.updatedAt || row.createdAt)].filter(Boolean).map((value: any) => new Date(value));
  const lastActivityAt = activityDates.sort((a: Date, b: Date) => b.getTime() - a.getTime())[0] || project.updatedAt || project.createdAt;
  const deadline = project.deadline ? new Date(project.deadline) : null;
  const today = dateOnlyToArgentinaDate(formatDateOnlyArgentina(new Date()))!;
  const in7 = new Date(today.getTime() + 7 * 86400000);
  const in15 = new Date(today.getTime() + 15 * 86400000);
  const deadlineStatus = !deadline
    ? 'sin_fecha'
    : deadline.getTime() === today.getTime()
      ? 'vence_hoy'
      : deadline < today
        ? 'vencido'
        : deadline <= in7
          ? 'esta_semana'
          : deadline <= in15
            ? 'proximo'
            : 'en_termino';
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    requesterDependency: project.requesterDependency,
    assignedEmployeeIds: (project.assignedEmployees || []).map((e: any) => e.id),
    ownerId: project.ownerId || '',
    ownerName: project.owner?.name || '',
    status: fromProjectStatus(project.status),
    year: project.year,
    difficulty: project.difficulty,
    deadline: dateOnly(project.deadline),
    repositoryApiUrl: project.repositoryApiUrl || '',
    repositoryWebUrl: project.repositoryWebUrl || '',
    branch: project.branch || '',
    techStack: project.techStack || '',
    notes: project.notes || '',
    needsRedesign: project.needsRedesign || false,
    needsRework: project.needsRework || false,
    lastProgressDate: lastProgress ? new Date(lastProgress.createdAt).toISOString() : '',
    lastDeployDate: lastDeploy ? new Date(lastDeploy.deployedAt).toISOString() : '',
    deadlineStatus,
    updatedAt: project.updatedAt ? new Date(project.updatedAt).toISOString() : '',
    lastActivityAt: lastActivityAt ? new Date(lastActivityAt).toISOString() : '',
    updates: updates.map((u: any) => ({
      id: u.id,
      authorName: u.authorName,
      date: new Date(u.createdAt).toISOString().slice(0, 16).replace('T', ' '),
      title: u.title || '',
      description: u.description || '',
      content: u.content,
      status: u.status || '',
      blockers: u.blockers || '',
      nextStep: u.nextStep || '',
      hours: u.hours ?? undefined,
      activityType: u.activityType || 'PROJECT',
    })),
    deployments: deployments.map(deploymentToDto),
  };
}

export function deploymentToDto(deployment: any) {
  return {
    id: deployment.id,
    projectId: deployment.projectId,
    environment: deployment.environment,
    status: deployment.status,
    apiCommit: deployment.apiCommit || '',
    webCommit: deployment.webCommit || '',
    apiRepoUrl: deployment.apiRepoUrl || '',
    webRepoUrl: deployment.webRepoUrl || '',
    server: deployment.server || '',
    deployedById: deployment.deployedById || '',
    deployedByName: deployment.deployedBy?.employee?.name || deployment.deployedBy?.email || deployment.deployedBy?.cuil || '',
    notes: deployment.notes || '',
    deployedAt: new Date(deployment.deployedAt).toISOString(),
  };
}

export function licenseToDto(req: any) {
  return {
    id: req.id,
    employeeId: req.employeeId,
    articleId: req.articleId || '',
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
    projectId: log.projectId || '',
    projectName: log.project?.name || '',
    secondaryWorkItemId: log.secondaryWorkItemId || '',
    secondaryWorkItemName: log.secondaryWorkItem?.name || '',
    workItemType: log.projectId ? 'PROJECT' : (log.secondaryWorkItemId ? 'SECONDARY' : 'FREE_TEXT'),
    displayTitle: log.project?.name || log.secondaryWorkItem?.name || log.title,
    title: log.title,
    description: log.description,
    date: dateOnly(log.date),
    mode: fromWorkLogMode(log.mode),
    activityType: log.activityType || 'PROJECT',
    hours: log.hours ?? undefined,
    entryTime: log.entryTime || '',
    exitTime: log.exitTime || '',
  };
}
