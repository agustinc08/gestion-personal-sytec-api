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
