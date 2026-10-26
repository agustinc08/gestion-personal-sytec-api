import { Injectable } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import { addDays, dateOnlyToArgentinaDate, dateOnlyToArgentinaDayRange, formatDateOnlyArgentina, getArgentinaTodayDateOnly, monthRangeArgentina } from '../../shared/date-utils';
import { fromWorkLogMode } from '../../shared/mappers';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}
  async admin() {
    const today = dateOnlyToArgentinaDate(getArgentinaTodayDateOnly())!;
    const in7 = addDays(today, 7);
    const in15 = addDays(today, 15);
    const [
      employees,
      projects,
      pendingLicenses,
      workLogs,
      projectsInDevelopment,
      projectsReadyForGit,
      projectsReadyForDocker,
      projectsDeployed,
      projectsFinished,
      projectsNeedRedesign,
      projectsNeedRework,
      overdueProjects,
      dueTodayProjects,
      dueThisWeekProjects,
      dueIn15DaysProjects,
      projectsWithoutDeadline,
      projectsWithoutOwner,
    ] = await Promise.all([
      this.prisma.employee.count({ where: { deletedAt: null } }),
      this.prisma.project.count({ where: { deletedAt: null } }),
      this.prisma.licenseRequest.count({ where: { status: 'PENDING', deletedAt: null } }),
      this.prisma.workLog.count({ where: { deletedAt: null } }),
      this.prisma.project.count({ where: { deletedAt: null, status: ProjectStatus.IN_PROGRESS } }),
      this.prisma.project.count({ where: { deletedAt: null, status: ProjectStatus.READY_FOR_GIT } }),
      this.prisma.project.count({ where: { deletedAt: null, status: ProjectStatus.READY_FOR_DOCKER } }),
      this.prisma.project.count({ where: { deletedAt: null, status: ProjectStatus.DEPLOYED } }),
      this.prisma.project.count({ where: { deletedAt: null, status: { in: [ProjectStatus.COMPLETED, ProjectStatus.FINISHED] } } }),
      this.prisma.project.count({ where: { deletedAt: null, OR: [{ status: ProjectStatus.NEEDS_REDESIGN }, { needsRedesign: true }] } }),
      this.prisma.project.count({ where: { deletedAt: null, OR: [{ status: ProjectStatus.NEEDS_REWORK }, { needsRework: true }] } }),
      this.prisma.project.count({ where: { deletedAt: null, deadline: { lt: today } } }),
      this.prisma.project.count({ where: { deletedAt: null, deadline: { gte: today, lt: new Date(today.getTime() + 86400000) } } }),
      this.prisma.project.count({ where: { deletedAt: null, deadline: { gte: today, lte: in7 } } }),
      this.prisma.project.count({ where: { deletedAt: null, deadline: { gt: in7, lte: in15 } } }),
      this.prisma.project.count({ where: { deletedAt: null, deadline: null } }),
      this.prisma.project.count({ where: { deletedAt: null, ownerId: null } }),
    ]);
    return {
      employees,
      projects,
      pendingLicenses,
      workLogs,
      projectsInDevelopment,
      projectsReadyForGit,
      projectsReadyForDocker,
      projectsDeployed,
      projectsFinished,
      projectsNeedRedesign,
      projectsNeedRework,
      overdueProjects,
      dueTodayProjects,
      dueThisWeekProjects,
      dueIn15DaysProjects,
      projectsWithoutDeadline,
      projectsWithoutOwner,
    };
  }
  async adminSummary() {
    const todayKey = getArgentinaTodayDateOnly();
    const { start: today, end: tomorrow } = dateOnlyToArgentinaDayRange(todayKey);
    const [summaryYear, summaryMonth] = todayKey.split('-').map(Number);
    const monthStart = monthRangeArgentina(summaryYear, summaryMonth).start;
    const alertLimit = addDays(today, 15);
    const [employeesActive, dependenciesActive, workLogsToday, expectedEmployees, pendingLicenses, approvedLicensesMonth, activeProjects, overdueProjects, upcomingProjects, strike, recentAudit, stackRows, employeesWithLatestLogs] = await Promise.all([
      this.prisma.employee.count({ where: { deletedAt: null } }),
      this.prisma.dependency.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.workLog.count({ where: { deletedAt: null, date: { gte: today, lt: tomorrow } } }),
      this.prisma.user.count({ where: { deletedAt: null, role: 'EMPLOYEE', employee: { deletedAt: null } } }),
      this.prisma.licenseRequest.count({ where: { deletedAt: null, status: 'PENDING' } }),
      this.prisma.licenseRequest.count({ where: { deletedAt: null, status: 'APPROVED', updatedAt: { gte: monthStart } } }),
      this.prisma.project.count({ where: { deletedAt: null, status: { notIn: [ProjectStatus.COMPLETED, ProjectStatus.FINISHED, ProjectStatus.ARCHIVED] } } }),
      this.prisma.project.count({ where: { deletedAt: null, deadline: { lt: today } } }),
      this.prisma.project.count({ where: { deletedAt: null, deadline: { gte: today, lte: alertLimit } } }),
      this.prisma.strikeConfig.findUnique({ where: { id: 'default' } }),
      this.prisma.auditLog.findMany({ include: { employee: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 6 }),
      this.prisma.project.findMany({ where: { deletedAt: null, techStack: { not: null } }, select: { techStack: true } }),
      this.prisma.employee.findMany({
        where: { deletedAt: null, user: { is: { role: 'EMPLOYEE', deletedAt: null } } },
        select: {
          id: true,
          name: true,
          dependency: true,
          dependencyRef: { select: { name: true } },
          workLogs: {
            where: { deletedAt: null },
            include: { project: { select: { id: true, name: true, techStack: true } }, secondaryWorkItem: { select: { id: true, name: true } } },
            orderBy: [{ date: 'desc' }, { updatedAt: 'desc' }],
            take: 1,
          },
          dailyAttendances: {
            orderBy: [{ date: 'desc' }, { updatedAt: 'desc' }],
            take: 7,
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);
    const technologyCounts = new Map<string, number>();
    stackRows.flatMap((row) => (row.techStack || '').split(/[,;/|]+/)).map((value) => value.trim()).filter(Boolean).forEach((value) => technologyCounts.set(value, (technologyCounts.get(value) || 0) + 1));
    return {
      employeesActive, dependenciesActive, workLogsToday, workLogsPendingToday: Math.max(0, expectedEmployees - workLogsToday), pendingLicenses,
      approvedLicensesMonth, activeProjects, overdueProjects, upcomingProjects,
      nextStrikeDuty: strike?.nextDate ? { date: strike.nextDate, employeeId: strike.nextCoverEmployeeId, notes: strike.notes } : null,
      technologies: [...technologyCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count })),
      latestWorkLogsByEmployee: employeesWithLatestLogs.map((employee) => {
        const log = employee.workLogs[0];
        const logDate = log ? formatDateOnlyArgentina(log.date) : '';
        const attendance = log
          ? employee.dailyAttendances.find((row) => formatDateOnlyArgentina(row.date) === logDate) || employee.dailyAttendances[0]
          : employee.dailyAttendances[0];
        const attendanceDto = attendance ? {
          id: attendance.id,
          employeeId: attendance.employeeId,
          date: formatDateOnlyArgentina(attendance.date),
          entryTime: attendance.entryTime,
          exitTime: attendance.exitTime,
          updatedAt: attendance.updatedAt,
        } : null;
        return {
          employeeId: employee.id,
          employeeName: employee.name,
          dependency: employee.dependencyRef?.name || employee.dependency,
          workLog: log ? {
            id: log.id,
            date: formatDateOnlyArgentina(log.date),
            mode: log.mode,
            title: log.title,
            description: log.description,
            activityType: log.activityType,
            hours: log.hours,
            entryTime: log.entryTime,
            exitTime: log.exitTime,
            projectId: log.projectId,
            projectName: log.project?.name || '',
            secondaryWorkItemId: log.secondaryWorkItemId || '',
            secondaryWorkItemName: log.secondaryWorkItem?.name || '',
            workItemType: log.projectId ? 'PROJECT' : (log.secondaryWorkItemId ? 'SECONDARY' : 'FREE_TEXT'),
            projectTechStack: log.project?.techStack || '',
            attendance: attendanceDto,
          } : null,
          attendance: attendanceDto,
        };
      }),
      recentAudit: recentAudit.map((row) => ({ id: row.id, action: row.action, module: row.module, title: row.title, detail: row.detail, employeeName: row.employee?.name, createdAt: row.createdAt })),
    };
  }
  async employee(employeeId?: string | null) {
    if (!employeeId) return {};
    const [licenses, workLogs, projects] = await Promise.all([
      this.prisma.licenseRequest.count({ where: { employeeId, deletedAt: null } }),
      this.prisma.workLog.count({ where: { employeeId, deletedAt: null } }),
      this.prisma.project.findMany({
        where: { deletedAt: null, assignedEmployees: { some: { id: employeeId } } },
        select: { id: true, name: true, status: true, year: true, difficulty: true, deadline: true, updatedAt: true },
        orderBy: [{ deadline: 'asc' }, { updatedAt: 'desc' }],
      }),
    ]);
    const today = new Date();
    const in15 = new Date(today.getTime() + 15 * 86400000);
    return {
      licenses,
      workLogs,
      projects: projects.map((project) => ({
        ...project,
        deadlineStatus: !project.deadline ? 'sin_fecha' : project.deadline < today ? 'vencido' : project.deadline <= in15 ? 'proximo' : 'en_termino',
      })),
    };
  }
  async adminWorklogCalendar(query: Record<string, string>) {
    const { start, end, year, month } = monthRangeArgentina(query.year, query.month);
    const [logs, attendances, employees] = await Promise.all([
      this.prisma.workLog.findMany({
        where: { deletedAt: null, date: { gte: start, lt: end } },
        include: { employee: { include: { dependencyRef: true } }, project: { select: { id: true, name: true } }, secondaryWorkItem: { select: { id: true, name: true } } },
        orderBy: [{ date: 'asc' }, { updatedAt: 'desc' }],
      }),
      this.prisma.dailyAttendance.findMany({
        where: { date: { gte: start, lt: end } },
        include: { employee: { include: { dependencyRef: true } } },
        orderBy: [{ date: 'asc' }, { updatedAt: 'desc' }],
      }),
      this.prisma.employee.findMany({
        where: { deletedAt: null, user: { is: { role: 'EMPLOYEE', deletedAt: null } } },
        include: { dependencyRef: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const attendanceByEmployeeDate = new Map(attendances.map((row) => [row.employeeId + ':' + formatDateOnlyArgentina(row.date), row]));
    const employeesWithLogs = new Set(logs.map((row) => row.employeeId));
    return {
      year,
      month,
      items: logs.map((log) => {
        const date = formatDateOnlyArgentina(log.date);
        const attendance = attendanceByEmployeeDate.get(log.employeeId + ':' + date);
        return {
          id: log.id,
          date,
          employeeId: log.employeeId,
          employeeName: log.employee?.name || '',
          dependency: log.employee?.dependencyRef?.name || log.employee?.dependency || '',
          mode: fromWorkLogMode(log.mode),
          activityType: log.activityType || 'PROJECT',
          title: log.title,
          description: log.description,
          hours: log.hours,
          projectId: log.projectId || '',
          projectName: log.project?.name || '',
          secondaryWorkItemId: log.secondaryWorkItemId || '',
          secondaryWorkItemName: log.secondaryWorkItem?.name || '',
          workItemType: log.projectId ? 'PROJECT' : (log.secondaryWorkItemId ? 'SECONDARY' : 'FREE_TEXT'),
          attendance: attendance ? { entryTime: attendance.entryTime || '', exitTime: attendance.exitTime || '' } : null,
        };
      }),
      employeesWithoutLogs: employees.filter((employee) => !employeesWithLogs.has(employee.id)).map((employee) => ({
        employeeId: employee.id,
        employeeName: employee.name,
        dependency: employee.dependencyRef?.name || employee.dependency || '',
      })),
    };
  }

}
