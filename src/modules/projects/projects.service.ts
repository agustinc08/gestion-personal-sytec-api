import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeployEnvironment, DeployStatus, Role } from '@prisma/client';
import { deploymentToDto, projectToDto, toDate, toProjectDifficulty, toProjectStatus } from '../../shared/mappers';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeploymentDto } from './dto/create-deployment.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateProjectUpdateDto } from './dto/create-project-update.dto';
import { UpdateDeploymentDto } from './dto/update-deployment.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AuditService } from '../audit/audit.service';
import { getConfiguredPageSize, paginate, paginationRequested } from '../../shared/pagination';
import { addDateOnlyDays, dateOnlyToArgentinaDayRange, getArgentinaTodayDateOnly } from '../../shared/date-utils';

const projectInclude = {
  assignedEmployees: true,
  owner: true,
  updates: { orderBy: { createdAt: 'asc' as const } },
  workLogs: { where: { deletedAt: null }, orderBy: [{ updatedAt: 'desc' as const }, { createdAt: 'desc' as const }, { date: 'desc' as const }], take: 1 },
  comments: { where: { deletedAt: null }, orderBy: [{ updatedAt: 'desc' as const }, { createdAt: 'desc' as const }], take: 1 },
  deployments: { orderBy: [{ updatedAt: 'desc' as const }, { deployedAt: 'desc' as const }, { createdAt: 'desc' as const }], include: { deployedBy: { include: { employee: true } } } },
};

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private normalizeTechStack(value?: string | null) {
    const seen = new Set<string>();
    return (value || '')
      .split(/[,;/|]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => {
        const key = item.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .join(', ');
  }

  private accessWhere(user: JwtUser) {
    return user.role === Role.ADMIN ? {} : { assignedEmployees: { some: { id: user.employeeId || '' } } };
  }

  private assertAdminOrAssigned(project: any, user: JwtUser) {
    if (user.role === Role.ADMIN) return;
    const assigned = project.assignedEmployees?.some((employee: any) => employee.id === user.employeeId);
    if (!assigned) throw new ForbiddenException();
  }

  private deployEnvironment(value?: string) {
    return ({ LOCAL: DeployEnvironment.LOCAL, DEV: DeployEnvironment.DEV, TEST: DeployEnvironment.TEST, PROD: DeployEnvironment.PROD }[value || 'DEV'] || DeployEnvironment.DEV);
  }

  private deployStatus(value?: string) {
    return ({ PENDING: DeployStatus.PENDING, SUCCESS: DeployStatus.SUCCESS, FAILED: DeployStatus.FAILED, ROLLED_BACK: DeployStatus.ROLLED_BACK }[value || 'PENDING'] || DeployStatus.PENDING);
  }

  async findAll(user: JwtUser, query: any = {}) {
    const where: any = { deletedAt: null, ...this.accessWhere(user) };
    if (query.year) where.year = Number(query.year);
    if (query.status) where.status = toProjectStatus(query.status);
    if (query.difficulty) where.difficulty = toProjectDifficulty(query.difficulty);
    if (query.ownerId === 'none') where.ownerId = null;
    else if (query.ownerId) where.ownerId = query.ownerId;
    const addAnd = (condition: any) => { where.AND = [...(where.AND || []), condition]; };
    if (query.needsRedesign === 'true') addAnd({ OR: [{ needsRedesign: true }, { status: toProjectStatus('necesita_rediseno') }] });
    if (query.needsRedesign === 'false') addAnd({ needsRedesign: false, status: { not: toProjectStatus('necesita_rediseno') } });
    if (query.needsRework === 'true') addAnd({ OR: [{ needsRework: true }, { status: toProjectStatus('necesita_rehacer') }] });
    if (query.needsRework === 'false') addAnd({ needsRework: false, status: { not: toProjectStatus('necesita_rehacer') } });
    if (query.assignedEmployeeId) where.assignedEmployees = { some: { id: query.assignedEmployeeId } };
    if (query.q) where.name = { contains: String(query.q), mode: 'insensitive' };
    if (query.from || query.to) where.createdAt = { ...(query.from ? { gte: dateOnlyToArgentinaDayRange(query.from).start } : {}), ...(query.to ? { lt: dateOnlyToArgentinaDayRange(query.to).end } : {}) };
    const lifecycleStatus = query.lifecycle === 'active'
      ? { in: ['ACTIVE', 'PENDING', 'IN_PROGRESS', 'PAUSED', 'IN_REVIEW', 'READY_FOR_GIT', 'IN_DEV_BRANCH', 'READY_FOR_DOCKER', 'DOCKERIZED', 'DEPLOYED', 'NEEDS_REWORK', 'NEEDS_REDESIGN'] }
      : query.lifecycle === 'completed' ? { in: ['COMPLETED', 'FINISHED'] }
        : query.lifecycle === 'archived' ? 'ARCHIVED' : undefined;
    if (lifecycleStatus !== undefined) {
      if (query.status) addAnd({ status: lifecycleStatus });
      else where.status = lifecycleStatus;
    }
    if (query.deadlineStatus) {
      const today = getArgentinaTodayDateOnly();
      const todayRange = dateOnlyToArgentinaDayRange(today);
      const weekEnd = addDateOnlyDays(today, 7);
      const twoWeekEnd = addDateOnlyDays(today, 15);
      const weekEndRange = dateOnlyToArgentinaDayRange(weekEnd);
      const twoWeekEndRange = dateOnlyToArgentinaDayRange(twoWeekEnd);
      if (query.deadlineStatus === 'sin_fecha') where.deadline = null;
      if (query.deadlineStatus === 'vencido') where.deadline = { lt: todayRange.start };
      if (query.deadlineStatus === 'vence_hoy') where.deadline = { gte: todayRange.start, lt: todayRange.end };
      if (query.deadlineStatus === 'esta_semana') where.deadline = { gte: todayRange.end, lt: weekEndRange.end };
      if (query.deadlineStatus === 'proximo') where.deadline = { gte: weekEndRange.end, lt: twoWeekEndRange.end };
    }
    const fetch = async (options?: { skip: number; take: number }) => (await this.prisma.project.findMany({ where, include: projectInclude, orderBy: [{ year: 'desc' }, { updatedAt: 'desc' }], ...(options || {}) })).map(projectToDto);
    if (!paginationRequested(query)) return (await fetch()).sort((a: any, b: any) => String(b.lastActivityAt || b.updatedAt || '').localeCompare(String(a.lastActivityAt || a.updatedAt || '')));
    return paginate(query, await getConfiguredPageSize(this.prisma), fetch, () => this.prisma.project.count({ where }));
  }

  async findOne(id: string, user: JwtUser) {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null, ...this.accessWhere(user) },
      include: projectInclude,
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return projectToDto(project);
  }

  async create(dto: CreateProjectDto, user: JwtUser) {
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        requesterDependency: dto.requesterDependency,
        status: toProjectStatus(dto.status),
        year: dto.year || new Date().getFullYear(),
        difficulty: toProjectDifficulty(dto.difficulty),
        deadline: dto.deadline ? toDate(dto.deadline) : undefined,
        ownerId: dto.ownerId === '' ? null : dto.ownerId || undefined,
        repositoryApiUrl: dto.repositoryApiUrl,
        repositoryWebUrl: dto.repositoryWebUrl,
        branch: dto.branch,
        techStack: this.normalizeTechStack(dto.techStack),
        notes: dto.notes,
        needsRedesign: dto.needsRedesign || false,
        needsRework: dto.needsRework || false,
        assignedEmployees: { connect: (dto.assignedEmployeeIds || []).map((id) => ({ id })) },
        updates: {
          create: {
            authorId: user.employeeId,
            authorName: 'Administracion',
            content: 'Proyecto creado.',
          },
        },
      },
      include: projectInclude,
    });
    await this.audit.record(user, { action: 'CREATE', module: 'PROJECTS', entityType: 'Project', entityId: project.id, title: project.name, detail: 'Proyecto creado' });
    return projectToDto(project);
  }

  async update(id: string, dto: UpdateProjectDto, user: JwtUser) {
    const current = await this.prisma.project.findFirst({ where: { id, deletedAt: null }, include: projectInclude });
    if (!current) throw new NotFoundException('Proyecto no encontrado');
    this.assertAdminOrAssigned(current, user);

    if (user.role !== Role.ADMIN) {
      const updateOnly = Object.keys(dto).every((key) => ['updates'].includes(key));
      if (!updateOnly) throw new ForbiddenException();
    }

    const nextStatus = dto.status ? toProjectStatus(dto.status) : undefined;
    const project = await this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        requesterDependency: dto.requesterDependency,
        status: nextStatus,
        year: dto.year,
        difficulty: dto.difficulty ? toProjectDifficulty(dto.difficulty) : undefined,
        deadline: dto.deadline ? toDate(dto.deadline) : dto.deadline === '' ? null : undefined,
        ownerId: dto.ownerId || undefined,
        repositoryApiUrl: dto.repositoryApiUrl,
        repositoryWebUrl: dto.repositoryWebUrl,
        branch: dto.branch,
        techStack: dto.techStack === undefined ? undefined : this.normalizeTechStack(dto.techStack),
        notes: dto.notes,
        needsRedesign: dto.needsRedesign,
        needsRework: dto.needsRework,
        assignedEmployees: dto.assignedEmployeeIds ? { set: dto.assignedEmployeeIds.map((eid) => ({ id: eid })) } : undefined,
        updates: nextStatus && nextStatus !== current.status ? {
          create: {
            authorId: user.employeeId,
            authorName: user.role === Role.ADMIN ? 'Administracion' : 'Empleado',
            content: `Estado actualizado de ${current.status} a ${nextStatus}.`,
          },
        } : undefined,
      },
      include: projectInclude,
    });
    await this.audit.record(user, { action: 'UPDATE', module: 'PROJECTS', entityType: 'Project', entityId: project.id, title: project.name, detail: 'Proyecto editado' });
    return projectToDto(project);
  }

  async remove(id: string, user: JwtUser) {
    const current = await this.prisma.project.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Proyecto no encontrado');
    await this.prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record(user, { action: 'DELETE', module: 'PROJECTS', entityType: 'Project', entityId: id, title: current.name, detail: 'Proyecto ocultado de los listados' });
    return { status: 'success' };
  }

  async updates(id: string, user: JwtUser) {
    return (await this.findOne(id, user)).updates || [];
  }

  async my(user: JwtUser) {
    return this.findAll(user, {});
  }

  async addUpdate(id: string, dto: CreateProjectUpdateDto, user: JwtUser) {
    const current = await this.prisma.project.findFirst({ where: { id, deletedAt: null }, include: { assignedEmployees: true } });
    if (!current) throw new NotFoundException('Proyecto no encontrado');
    this.assertAdminOrAssigned(current, user);

    const update = await this.prisma.projectUpdate.create({
      data: {
        projectId: id,
        content: dto.content,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        blockers: dto.blockers,
        nextStep: dto.nextStep,
        hours: dto.hours,
        activityType: dto.activityType,
        authorName: dto.authorName || (user.role === Role.ADMIN ? 'Administracion' : 'Empleado'),
        authorId: user.employeeId,
      },
    });
    await this.audit.record(user, { action: 'CREATE_UPDATE', module: 'PROJECTS', entityType: 'ProjectUpdate', entityId: update.id, title: current.name, detail: 'Avance de proyecto agregado' });
    return this.findOne(id, user);
  }

  async deployments(id: string, user: JwtUser) {
    await this.findOne(id, user);
    const deployments = await this.prisma.deployment.findMany({
      where: { projectId: id },
      orderBy: { deployedAt: 'desc' },
      include: { deployedBy: { include: { employee: true } } },
    });
    return deployments.map(deploymentToDto);
  }

  async addDeployment(id: string, dto: CreateDeploymentDto, user: JwtUser) {
    if (user.role !== Role.ADMIN) throw new ForbiddenException();
    const current = await this.prisma.project.findFirst({ where: { id, deletedAt: null }, include: { assignedEmployees: true } });
    if (!current) throw new NotFoundException('Proyecto no encontrado');
    this.assertAdminOrAssigned(current, user);

    const deployment = await this.prisma.deployment.create({
      data: {
        projectId: id,
        environment: this.deployEnvironment(dto.environment),
        status: this.deployStatus(dto.status),
        apiCommit: dto.apiCommit,
        webCommit: dto.webCommit,
        apiRepoUrl: dto.apiRepoUrl,
        webRepoUrl: dto.webRepoUrl,
        server: dto.server,
        notes: dto.notes,
        deployedAt: dto.deployedAt ? new Date(dto.deployedAt) : undefined,
        deployedById: user.id,
      },
      include: { deployedBy: { include: { employee: true } } },
    });
    return deploymentToDto(deployment);
  }

  async updateDeployment(id: string, dto: UpdateDeploymentDto, user: JwtUser) {
    if (user.role !== Role.ADMIN) throw new ForbiddenException();
    const deployment = await this.prisma.deployment.findUnique({ where: { id } });
    if (!deployment) throw new NotFoundException('Deploy no encontrado');

    return deploymentToDto(await this.prisma.deployment.update({
      where: { id },
      data: {
        environment: dto.environment ? this.deployEnvironment(dto.environment) : undefined,
        status: dto.status ? this.deployStatus(dto.status) : undefined,
        apiCommit: dto.apiCommit,
        webCommit: dto.webCommit,
        apiRepoUrl: dto.apiRepoUrl,
        webRepoUrl: dto.webRepoUrl,
        server: dto.server,
        notes: dto.notes,
        deployedAt: dto.deployedAt ? new Date(dto.deployedAt) : undefined,
      },
      include: { deployedBy: { include: { employee: true } } },
    }));
  }

  async removeDeployment(id: string, user: JwtUser) {
    if (user.role !== Role.ADMIN) throw new ForbiddenException();
    const deployment = await this.prisma.deployment.findUnique({ where: { id } });
    if (!deployment) throw new NotFoundException('Deploy no encontrado');
    await this.prisma.deployment.delete({ where: { id } });
    return { status: 'success' };
  }

  async deadlines(user: JwtUser) {
    const result = await this.findAll(user);
    const projects = Array.isArray(result) ? result : result.items;
    const today = getArgentinaTodayDateOnly();
    const in7 = addDateOnlyDays(today, 7);
    const in15 = addDateOnlyDays(today, 15);

    return projects.map((project: any) => {
      const deadline = project.deadline ? String(project.deadline).slice(0, 10) : '';
      return { ...project, deadlineStatus: !deadline ? 'sin_fecha' : deadline < today ? 'vencido' : deadline <= in7 ? 'esta_semana' : deadline <= in15 ? 'proximo' : 'en_termino' };
    });
  }

  async comments(id: string, user: JwtUser) {
    await this.findOne(id, user);
    const rows = await this.prisma.projectComment.findMany({
      where: { projectId: id, deletedAt: null },
      include: { author: { include: { employee: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({ id: row.id, projectId: row.projectId, authorUserId: row.authorUserId, authorName: row.author.employee?.name || (row.author.role === Role.ADMIN ? 'Administración' : row.author.cuil), message: row.message, createdAt: row.createdAt, updatedAt: row.updatedAt, canDelete: user.role === Role.ADMIN || row.authorUserId === user.id }));
  }

  async addComment(id: string, message: string, user: JwtUser) {
    await this.findOne(id, user);
    const comment = await this.prisma.projectComment.create({ data: { projectId: id, authorUserId: user.id, message: message.trim() } });
    await this.audit.record(user, { action: 'CREATE_COMMENT', module: 'PROJECTS', entityType: 'ProjectComment', entityId: comment.id, title: 'Comentario agregado', detail: `Comentario interno en proyecto ${id}` });
    return this.comments(id, user);
  }

  async deleteComment(id: string, commentId: string, user: JwtUser) {
    await this.findOne(id, user);
    const comment = await this.prisma.projectComment.findFirst({ where: { id: commentId, projectId: id, deletedAt: null } });
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    if (user.role !== Role.ADMIN && comment.authorUserId !== user.id) throw new ForbiddenException();
    await this.prisma.projectComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
    await this.audit.record(user, { action: 'DELETE_COMMENT', module: 'PROJECTS', entityType: 'ProjectComment', entityId: commentId, title: 'Comentario eliminado', detail: `Comentario interno en proyecto ${id}` });
    return { status: 'success', message: 'Proyecto eliminado correctamente' };
  }
}
