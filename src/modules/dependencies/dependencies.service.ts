import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDependencyDto } from './dto/create-dependency.dto';
import { UpdateDependencyDto } from './dto/update-dependency.dto';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class DependenciesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  findAll() {
    return this.prisma.dependency.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { employees: { where: { deletedAt: null } } } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    }).then((rows) => rows.map((row) => ({ ...row, employeeCount: row._count.employees, _count: undefined })));
  }

  private async assertUnique(name: string, exceptId?: string) {
    const existing = await this.prisma.dependency.findFirst({ where: { name: { equals: name.trim(), mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) } });
    if (existing) throw new ConflictException('Ya existe una dependencia con ese nombre');
  }

  async create(dto: CreateDependencyDto, user: JwtUser) {
    const name = dto.name.trim();
    await this.assertUnique(name);
    const row = await this.prisma.dependency.create({ data: { name, description: dto.description?.trim() || null, isActive: dto.isActive ?? true } });
    await this.audit.record(user, { action: 'CREATE', module: 'DEPENDENCIES', entityType: 'Dependency', entityId: row.id, title: row.name, detail: 'Dependencia creada' });
    return row;
  }

  async update(id: string, dto: UpdateDependencyDto, user: JwtUser) {
    const current = await this.prisma.dependency.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Dependencia no encontrada');
    const name = dto.name?.trim();
    if (name) await this.assertUnique(name, id);
    const updated = await this.prisma.dependency.update({ where: { id }, data: { name, description: dto.description === undefined ? undefined : dto.description.trim() || null, isActive: dto.isActive } });
    if (name && name !== current.name) await this.prisma.employee.updateMany({ where: { dependencyId: id }, data: { dependency: name } });
    await this.audit.record(user, { action: 'UPDATE', module: 'DEPENDENCIES', entityType: 'Dependency', entityId: id, title: updated.name, detail: 'Dependencia editada' });
    return updated;
  }

  async remove(id: string, user: JwtUser) {
    const current = await this.prisma.dependency.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Dependencia no encontrada');
    await this.prisma.dependency.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
    await this.audit.record(user, { action: 'DELETE', module: 'DEPENDENCIES', entityType: 'Dependency', entityId: id, title: current.name, detail: 'Dependencia desactivada' });
    return { message: 'Dependencia desactivada correctamente' };
  }
}
