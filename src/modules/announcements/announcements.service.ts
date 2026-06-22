import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AnnouncementPriority, Prisma, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}
  private include = { targetDependency: true, targetEmployee: true, createdBy: { include: { employee: true } }, _count: { select: { reads: true } } } as const;
  private targetWhere(user: JwtUser): Prisma.AnnouncementWhereInput {
    return { OR: [
      { targetRole: null, targetDependencyId: null, targetEmployeeId: null },
      { targetRole: user.role },
      ...(user.employeeId ? [{ targetEmployeeId: user.employeeId }, { targetDependency: { employees: { some: { id: user.employeeId } } } }] : []),
    ] };
  }
  findAll() { return this.prisma.announcement.findMany({ where: { deletedAt: null }, include: this.include, orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }] }); }
  async findActive(user: JwtUser) {
    const now = new Date();
    const rows = await this.prisma.announcement.findMany({ where: { deletedAt: null, isActive: true, AND: [this.targetWhere(user), { OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] }, include: { ...this.include, reads: { where: { userId: user.id }, select: { readAt: true } } }, orderBy: [{ pinned: 'desc' }, { priority: 'desc' }, { createdAt: 'desc' }] });
    return rows.map((row) => ({ ...row, readAt: row.reads[0]?.readAt || null, reads: undefined }));
  }
  private data(dto: CreateAnnouncementDto | UpdateAnnouncementDto) {
    return { ...dto, title: dto.title?.trim(), message: dto.message?.trim(), targetRole: dto.targetRole || null, targetDependencyId: dto.targetDependencyId || null, targetEmployeeId: dto.targetEmployeeId || null, startsAt: dto.startsAt ? new Date(dto.startsAt) : dto.startsAt === '' ? null : undefined, endsAt: dto.endsAt ? new Date(dto.endsAt) : dto.endsAt === '' ? null : undefined };
  }
  async create(dto: CreateAnnouncementDto, user: JwtUser) {
    const row = await this.prisma.announcement.create({ data: { ...this.data(dto), title: dto.title.trim(), message: dto.message.trim(), createdByUserId: user.id }, include: this.include });
    await this.audit.record(user, { action: 'CREATE', module: 'ANNOUNCEMENTS', entityType: 'Announcement', entityId: row.id, title: row.title, detail: 'Comunicado creado' });
    await this.notify(row);
    return row;
  }
  async update(id: string, dto: UpdateAnnouncementDto, user: JwtUser) {
    const current = await this.prisma.announcement.findFirst({ where: { id, deletedAt: null } }); if (!current) throw new NotFoundException('Comunicado no encontrado');
    const row = await this.prisma.announcement.update({ where: { id }, data: this.data(dto), include: this.include });
    await this.audit.record(user, { action: 'UPDATE', module: 'ANNOUNCEMENTS', entityType: 'Announcement', entityId: id, title: row.title, detail: 'Comunicado editado' });
    await this.notify(row); return row;
  }
  async remove(id: string, user: JwtUser) {
    const current = await this.prisma.announcement.findFirst({ where: { id, deletedAt: null } }); if (!current) throw new NotFoundException('Comunicado no encontrado');
    await this.prisma.announcement.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    await this.audit.record(user, { action: 'DELETE', module: 'ANNOUNCEMENTS', entityType: 'Announcement', entityId: id, title: current.title, detail: 'Comunicado eliminado' });
    return { message: 'Comunicado eliminado correctamente' };
  }
  async read(id: string, user: JwtUser) {
    const allowed = await this.prisma.announcement.findFirst({ where: { id, deletedAt: null, AND: [this.targetWhere(user)] } }); if (!allowed) throw new ForbiddenException();
    return this.prisma.announcementRead.upsert({ where: { announcementId_userId: { announcementId: id, userId: user.id } }, update: { readAt: new Date() }, create: { announcementId: id, userId: user.id } });
  }
  async readAll(user: JwtUser) {
    const rows = await this.findActive(user); await Promise.all(rows.map((row) => this.prisma.announcementRead.upsert({ where: { announcementId_userId: { announcementId: row.id, userId: user.id } }, update: { readAt: new Date() }, create: { announcementId: row.id, userId: user.id } }))); return { status: 'ok' };
  }
  private async notify(row: any) {
    if (!row.pinned && row.priority !== AnnouncementPriority.URGENT) return;
    const users = await this.prisma.user.findMany({ where: { deletedAt: null, ...(row.targetEmployeeId ? { employeeId: row.targetEmployeeId } : row.targetDependencyId ? { employee: { dependencyId: row.targetDependencyId, deletedAt: null } } : row.targetRole ? { role: row.targetRole } : {}) }, select: { id: true } });
    await Promise.all(users.map((user) => this.prisma.notification.upsert({ where: { dedupeKey: `announcement:${row.id}:${user.id}` }, update: { title: row.title, message: row.message }, create: { userId: user.id, type: 'SYSTEM', title: row.title, message: row.message, link: '/?seccion=comunicados', dedupeKey: `announcement:${row.id}:${user.id}`, metadata: { announcementId: row.id } } })));
  }
}
