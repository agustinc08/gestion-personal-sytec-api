import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { projectToDto, toProjectStatus } from '../../shared/mappers';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateProjectUpdateDto } from './dto/create-project-update.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

const include = { assignedEmployees: true, updates: { orderBy: { createdAt: 'asc' as const } } };

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}
  async findAll() { return (await this.prisma.project.findMany({ where: { deletedAt: null }, include, orderBy: { createdAt: 'desc' } })).map(projectToDto); }
  async findOne(id: string) {
    const p = await this.prisma.project.findFirst({ where: { id, deletedAt: null }, include });
    if (!p) throw new NotFoundException('Proyecto no encontrado');
    return projectToDto(p);
  }
  async create(dto: CreateProjectDto) {
    const p = await this.prisma.project.create({ data: {
      name: dto.name, description: dto.description, requesterDependency: dto.requesterDependency, status: toProjectStatus(dto.status),
      assignedEmployees: { connect: dto.assignedEmployeeIds.map((id) => ({ id })) },
    }, include });
    return projectToDto(p);
  }
  async update(id: string, dto: UpdateProjectDto) {
    const p = await this.prisma.project.update({ where: { id }, data: {
      name: dto.name, description: dto.description, requesterDependency: dto.requesterDependency, status: dto.status ? toProjectStatus(dto.status) : undefined,
      assignedEmployees: dto.assignedEmployeeIds ? { set: dto.assignedEmployeeIds.map((eid) => ({ id: eid })) } : undefined,
    }, include });
    return projectToDto(p);
  }
  async remove(id: string) { await this.prisma.project.update({ where: { id }, data: { deletedAt: new Date() } }); return { status: 'success' }; }
  async updates(id: string) { return (await this.findOne(id)).updates || []; }
  async addUpdate(id: string, dto: CreateProjectUpdateDto, user: JwtUser) {
    if (user.role !== Role.ADMIN) {
      const p = await this.prisma.project.findFirst({ where: { id, assignedEmployees: { some: { id: user.employeeId || '' } } } });
      if (!p) throw new ForbiddenException();
    }
    await this.prisma.projectUpdate.create({ data: { projectId: id, content: dto.content, authorName: dto.authorName, authorId: user.employeeId } });
    return this.findOne(id);
  }
}
