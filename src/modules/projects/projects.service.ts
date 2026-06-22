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

const projectInclude = {
  assignedEmployees: true,
  owner: true,
  updates: { orderBy: { createdAt: 'asc' as const } },
  deployments: { orderBy: { deployedAt: 'desc' as const }, include: { deployedBy: { include: { employee: true } } } },
};

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

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
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.needsRedesign !== undefined) where.needsRedesign = query.needsRedesign === 'true';
    if (query.needsRework !== undefined) where.needsRework = query.needsRework === 'true';
    if (query.assignedEmployeeId) where.assignedEmployees = { some: { id: query.assignedEmployeeId } };
    if (query.q) where.name = { contains: String(query.q), mode: 'insensitive' };

    const projects = await this.prisma.project.findMany({
      where,
      include: projectInclude,
      orderBy: [{ year: 'desc' }, { updatedAt: 'desc' }],
    });
    return projects.map(projectToDto);
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
        techStack: dto.techStack,
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
        techStack: dto.techStack,
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
    const projects = await this.findAll(user);
    const today = new Date();
    const in7 = new Date(today.getTime() + 7 * 86400000);
    const in15 = new Date(today.getTime() + 15 * 86400000);

    return projects.map((project: any) => {
      const deadline = project.deadline ? new Date(`${project.deadline}T00:00:00`) : null;
      return {
        ...project,
        deadlineStatus: !deadline ? 'sin_fecha' : deadline < today ? 'vencido' : deadline <= in7 ? 'esta_semana' : deadline <= in15 ? 'proximo' : 'en_termino',
      };
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
