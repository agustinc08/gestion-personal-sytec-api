import { Injectable } from '@nestjs/common';
import { ActivityType, ProjectDifficulty, ProjectStatus, WorkLogMode } from '@prisma/client';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { toProjectDifficulty, toProjectStatus } from '../../shared/mappers';

const activityTypes = Object.values(ActivityType);

function textHasSupport(value?: string | null) {
  return (value || '').toLowerCase().includes('soporte');
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class StatisticsService {
  constructor(private prisma: PrismaService) {}

  private dateRange(query: Record<string, string>, field: 'createdAt' | 'date' | 'deployedAt') {
    const where: any = {};
    let from = query.from ? new Date(query.from) : undefined;
    let to = query.to ? new Date(query.to) : undefined;

    if (!from && query.year) {
      const year = Number(query.year);
      const month = query.month ? Number(query.month) - 1 : 0;
      from = new Date(year, month, 1);
      to = query.month ? new Date(year, month + 1, 0, 23, 59, 59, 999) : new Date(year, 11, 31, 23, 59, 59, 999);
    }
    if (to && query.to) to.setHours(23, 59, 59, 999);
    if (from || to) where[field] = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    return where;
  }

  private projectWhere(query: Record<string, string>, employeeId?: string) {
    const where: any = { deletedAt: null };
    if (query.projectId) where.id = query.projectId;
    if (query.projectStatus) where.status = toProjectStatus(query.projectStatus);
    if (query.difficulty) where.difficulty = toProjectDifficulty(query.difficulty);
    if (employeeId) where.assignedEmployees = { some: { id: employeeId } };
    return where;
  }

  private updateWhere(query: Record<string, string>, projectIds?: string[], employeeId?: string) {
    const where: any = { ...this.dateRange(query, 'createdAt') };
    if (projectIds) where.projectId = { in: projectIds };
    if (query.projectId) where.projectId = query.projectId;
    if (employeeId || query.employeeId) where.authorId = employeeId || query.employeeId;
    if (query.activityType && activityTypes.includes(query.activityType as ActivityType)) where.activityType = query.activityType as ActivityType;
    return where;
  }

  private workLogWhere(query: Record<string, string>, employeeId?: string, projectIds?: string[]) {
    const where: any = { deletedAt: null, ...this.dateRange(query, 'date') };
    if (employeeId || query.employeeId) where.employeeId = employeeId || query.employeeId;
    if (query.projectId) where.projectId = query.projectId;
    else if (query.projectStatus || query.difficulty) where.projectId = { in: projectIds || [] };
    if (query.activityType === ActivityType.SUPPORT) {
      where.OR = [
        { activityType: ActivityType.SUPPORT },
        { title: { contains: 'soporte', mode: 'insensitive' } },
        { description: { contains: 'soporte', mode: 'insensitive' } },
      ];
    } else if (query.activityType && activityTypes.includes(query.activityType as ActivityType)) {
      where.activityType = query.activityType as ActivityType;
    }
    return where;
  }

  private deploymentWhere(query: Record<string, string>, projectIds?: string[]) {
    const where: any = { ...this.dateRange(query, 'deployedAt') };
    if (projectIds) where.projectId = { in: projectIds };
    if (query.projectId) where.projectId = query.projectId;
    return where;
  }

  private summarize(projects: any[], updates: any[], workLogs: any[], deployments: any[], employees: any[]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const finishedStatuses: ProjectStatus[] = [ProjectStatus.COMPLETED, ProjectStatus.FINISHED];
    const isFinished = (status: ProjectStatus) => finishedStatuses.includes(status);
    const isSupportWorkLog = (w: any) => w.activityType === ActivityType.SUPPORT || textHasSupport(w.title) || textHasSupport(w.description);
    const supportUpdates = updates.filter((u) => u.activityType === ActivityType.SUPPORT || textHasSupport(u.title) || textHasSupport(u.description) || textHasSupport(u.content)).length
      + workLogs.filter(isSupportWorkLog).length;

    const byEmployee = employees.map((employee) => {
      const employeeUpdates = updates.filter((u) => u.authorId === employee.id);
      const employeeLogs = workLogs.filter((w) => w.employeeId === employee.id);
      const assignedProjects = projects.filter((p) => p.assignedEmployees?.some((assigned: any) => assigned.id === employee.id));
      return {
        employeeId: employee.id,
        employeeName: employee.name,
        assignedProjects: assignedProjects.length,
        updates: employeeUpdates.length + employeeLogs.length,
        supportUpdates: employeeUpdates.filter((u) => u.activityType === ActivityType.SUPPORT || textHasSupport(u.content)).length + employeeLogs.filter(isSupportWorkLog).length,
        hours: employeeUpdates.reduce((sum, update) => sum + (update.hours || 0), 0) + employeeLogs.reduce((sum, log) => sum + (log.hours || 0), 0),
      };
    }).filter((row) => row.assignedProjects || row.updates || row.hours);

    const byProject = projects.map((project) => {
      const projectUpdates = updates.filter((u) => u.projectId === project.id);
      const projectLogs = workLogs.filter((w) => w.projectId === project.id);
      const lastUpdate = projectUpdates.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
      return {
        projectId: project.id,
        projectName: project.name,
        status: project.status,
        difficulty: project.difficulty,
        updates: projectUpdates.length + projectLogs.length,
        supportUpdates: projectUpdates.filter((u) => u.activityType === ActivityType.SUPPORT || textHasSupport(u.content)).length + projectLogs.filter(isSupportWorkLog).length,
        hours: projectUpdates.reduce((sum, update) => sum + (update.hours || 0), 0) + projectLogs.reduce((sum, log) => sum + (log.hours || 0), 0),
        lastProgressDate: lastUpdate ? new Date(lastUpdate.createdAt).toISOString() : '',
      };
    }).filter((row) => row.updates || row.hours || row.projectName);

    const byActivityType = activityTypes.map((type) => ({
      activityType: type,
      label: type,
      count: updates.filter((u) => u.activityType === type).length + workLogs.filter((w) => w.activityType === type || (type === ActivityType.SUPPORT && isSupportWorkLog(w))).length,
      hours: updates.filter((u) => u.activityType === type).reduce((sum, update) => sum + (update.hours || 0), 0) + workLogs.filter((w) => w.activityType === type).reduce((sum, log) => sum + (log.hours || 0), 0),
    }));

    const byWorkMode = Object.values(WorkLogMode).map((mode) => ({
      mode,
      count: workLogs.filter((log) => log.mode === mode).length,
      hours: workLogs.filter((log) => log.mode === mode).reduce((sum, log) => sum + (log.hours || 0), 0),
    })).filter((row) => row.count || row.hours);

    const months = new Map<string, any>();
    for (const update of updates) {
      const key = monthKey(new Date(update.createdAt));
      const row = months.get(key) || { month: key, updates: 0, supports: 0, deploys: 0, hours: 0 };
      row.updates += 1;
      row.supports += update.activityType === ActivityType.SUPPORT || textHasSupport(update.content) ? 1 : 0;
      row.hours += update.hours || 0;
      months.set(key, row);
    }
    for (const log of workLogs) {
      const key = monthKey(new Date(log.date));
      const row = months.get(key) || { month: key, updates: 0, supports: 0, deploys: 0, hours: 0 };
      row.updates += 1;
      row.supports += isSupportWorkLog(log) ? 1 : 0;
      row.hours += log.hours || 0;
      months.set(key, row);
    }
    for (const deployment of deployments) {
      const key = monthKey(new Date(deployment.deployedAt));
      const row = months.get(key) || { month: key, updates: 0, supports: 0, deploys: 0, hours: 0 };
      row.deploys += 1;
      months.set(key, row);
    }

    return {
      summary: {
        totalProjects: projects.length,
        finishedProjects: projects.filter((p) => isFinished(p.status)).length,
        inProgressProjects: projects.filter((p) => p.status === ProjectStatus.IN_PROGRESS).length,
        deployedProjects: projects.filter((p) => p.status === ProjectStatus.DEPLOYED).length,
        overdueProjects: projects.filter((p) => p.deadline && new Date(p.deadline) < today).length,
        totalUpdates: updates.length + workLogs.length,
        supportUpdates,
        deploys: deployments.length,
        totalHours: updates.reduce((sum, update) => sum + (update.hours || 0), 0) + workLogs.reduce((sum, log) => sum + (log.hours || 0), 0),
      },
      byEmployee,
      byProject,
      byActivityType,
      byWorkMode,
      byMonth: Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month)),
      byStatus: Object.values(ProjectStatus).map((status) => ({ status, count: projects.filter((p) => p.status === status).length })).filter((x) => x.count),
      byDifficulty: Object.values(ProjectDifficulty).map((difficulty) => ({ difficulty, count: projects.filter((p) => p.difficulty === difficulty).length })).filter((x) => x.count),
    };
  }

  async admin(query: Record<string, string>) {
    const projects = await this.prisma.project.findMany({
      where: this.projectWhere(query),
      include: { assignedEmployees: true },
    });
    const projectIds = projects.map((project) => project.id);
    const [updates, workLogs, deployments, employees] = await Promise.all([
      this.prisma.projectUpdate.findMany({ where: this.updateWhere(query, projectIds), include: { project: true, author: true } }),
      this.prisma.workLog.findMany({ where: this.workLogWhere(query, undefined, projectIds) }),
      this.prisma.deployment.findMany({ where: this.deploymentWhere(query, projectIds) }),
      this.prisma.employee.findMany({ where: { deletedAt: null } }),
    ]);
    return this.summarize(projects, updates, workLogs, deployments, employees);
  }

  async me(user: JwtUser, query: Record<string, string>) {
    const employeeId = user.employeeId || '';
    const projects = await this.prisma.project.findMany({
      where: this.projectWhere(query, employeeId),
      include: { assignedEmployees: true },
    });
    const projectIds = projects.map((project) => project.id);
    const [updates, workLogs, deployments, employee] = await Promise.all([
      this.prisma.projectUpdate.findMany({ where: this.updateWhere(query, projectIds, employeeId), include: { project: true, author: true } }),
      this.prisma.workLog.findMany({ where: this.workLogWhere(query, employeeId, projectIds) }),
      this.prisma.deployment.findMany({ where: this.deploymentWhere(query, projectIds) }),
      this.prisma.employee.findUnique({ where: { id: employeeId } }),
    ]);
    const result = this.summarize(projects, updates, workLogs, deployments, employee ? [employee] : []);
    return {
      ...result,
      myProjects: projects.length,
      overdueProjects: projects.filter((project) => project.deadline && new Date(project.deadline) < new Date()).length,
      upcomingProjects: projects.filter((project) => {
        if (!project.deadline) return false;
        const deadline = new Date(project.deadline);
        const in15 = new Date(Date.now() + 15 * 86400000);
        return deadline >= new Date() && deadline <= in15;
      }).length,
    };
  }
}
