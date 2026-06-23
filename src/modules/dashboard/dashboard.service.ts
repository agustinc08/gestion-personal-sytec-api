import { Injectable } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}
  async admin() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7 = new Date(today.getTime() + 7 * 86400000);
    const in15 = new Date(today.getTime() + 15 * 86400000);
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
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const alertLimit = new Date(today.getTime() + 15 * 86400000);
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
            include: { project: { select: { id: true, name: true, techStack: true } } },
            orderBy: [{ date: 'desc' }, { updatedAt: 'desc' }],
            take: 1,
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
        return {
          employeeId: employee.id,
          employeeName: employee.name,
          dependency: employee.dependencyRef?.name || employee.dependency,
          workLog: log ? {
            id: log.id,
            date: log.date,
            mode: log.mode,
            title: log.title,
            hours: log.hours,
            entryTime: log.entryTime,
            exitTime: log.exitTime,
            projectId: log.projectId,
            projectName: log.project?.name || '',
            projectTechStack: log.project?.techStack || '',
          } : null,
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
}
