import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { toActivityType, toDate, toWorkLogMode, workLogToDto } from '../../shared/mappers';
import { dateOnlyToArgentinaDayRange, formatDateOnlyArgentina, monthRangeArgentina } from '../../shared/date-utils';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkLogDto } from './dto/create-work-log.dto';
import { UpdateWorkLogDto } from './dto/update-work-log.dto';
import { SaveDailyAttendanceDto } from './dto/save-daily-attendance.dto';
import { AuditService } from '../audit/audit.service';
import { SecondaryWorkItemsService } from '../secondary-work-items/secondary-work-items.service';

@Injectable()
export class WorkLogsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private secondaryWorkItems: SecondaryWorkItemsService) {}

  private validateTimes(entryTime?: string, exitTime?: string) {
    if (entryTime && exitTime && exitTime < entryTime) {
      throw new BadRequestException('La hora de salida no puede ser anterior a la hora de entrada');
    }
  }

  private where(query: Record<string, string> = {}, employeeId?: string) {
    const where: any = { deletedAt: null };
    if (employeeId || query.employeeId) where.employeeId = employeeId || query.employeeId;
    if (query.projectId) where.projectId = query.projectId;
    if (query.secondaryWorkItemId) where.secondaryWorkItemId = query.secondaryWorkItemId;
    if (query.activityType) where.activityType = toActivityType(query.activityType);
    if (query.mode) where.mode = toWorkLogMode(query.mode);
    if (query.year) {
      const { start, end } = monthRangeArgentina(query.year, query.month);
      where.date = { gte: start, lt: end };
    }
    return where;
  }

  async findAll(query: Record<string, string> = {}) {
    return (await this.prisma.workLog.findMany({ where: this.where(query), include: { project: true, secondaryWorkItem: true }, orderBy: { date: 'desc' } })).map(workLogToDto);
  }
  async findMine(user: JwtUser, query: Record<string, string> = {}) {
    return (await this.prisma.workLog.findMany({ where: this.where(query, user.employeeId || ''), include: { project: true, secondaryWorkItem: true }, orderBy: { date: 'desc' } })).map(workLogToDto);
  }
  private async resolveSecondaryWorkItem(dto: { projectId?: string; secondaryWorkItemId?: string; secondaryWorkItemName?: string; title?: string }, employeeId?: string | null) {
    if (dto.projectId) return null;
    if (dto.secondaryWorkItemId) return { id: dto.secondaryWorkItemId };
    const name = dto.secondaryWorkItemName || dto.title;
    if (!name?.trim()) return null;
    return this.secondaryWorkItems.findOrCreateByName(name, employeeId);
  }

  async create(dto: CreateWorkLogDto, user: JwtUser) {
    const employeeId = user.role === Role.ADMIN && dto.employeeId ? dto.employeeId : user.employeeId;
    if (!employeeId) throw new ForbiddenException();
    const date = toDate(dto.date)!;
    this.validateTimes(dto.entryTime, dto.exitTime);
    const secondaryWorkItem = await this.resolveSecondaryWorkItem(dto, employeeId);
    const created = await this.prisma.workLog.create({
      data: {
        employeeId,
        projectId: dto.projectId || null,
        secondaryWorkItemId: dto.projectId ? null : secondaryWorkItem?.id || null,
        title: dto.title,
        description: dto.description,
        date,
        mode: toWorkLogMode(dto.mode),
        activityType: toActivityType(dto.activityType),
        hours: dto.hours,
        entryTime: dto.entryTime || null,
        exitTime: dto.exitTime || null,
      },
      include: { project: true, secondaryWorkItem: true },
    });
    if (created.secondaryWorkItemId) await this.secondaryWorkItems.touch(created.secondaryWorkItemId, created.updatedAt || created.date);
    await this.audit.record(user, { action: 'CREATE', module: 'WORK_LOGS', entityType: 'WorkLog', entityId: created.id, title: created.title, detail: 'Parte diario creado' });
    return workLogToDto(created);
  }
  async update(id: string, dto: UpdateWorkLogDto, user: JwtUser) {
    const current = await this.prisma.workLog.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException();
    if (user.role !== Role.ADMIN && current.employeeId !== user.employeeId) throw new ForbiddenException();
    const date = dto.date ? toDate(dto.date)! : current.date;
    const nextEntryTime = dto.entryTime === undefined ? current.entryTime || undefined : dto.entryTime || undefined;
    const nextExitTime = dto.exitTime === undefined ? current.exitTime || undefined : dto.exitTime || undefined;
    this.validateTimes(nextEntryTime, nextExitTime);
    const nextProjectId = dto.projectId === undefined ? current.projectId : dto.projectId || null;
    const secondaryWorkItem = nextProjectId ? null : await this.resolveSecondaryWorkItem({ ...dto, projectId: nextProjectId || undefined, title: dto.title || current.title }, current.employeeId);
    const nextSecondaryWorkItemId = nextProjectId ? null : (secondaryWorkItem?.id ?? (dto.secondaryWorkItemId === '' ? null : dto.secondaryWorkItemId ?? current.secondaryWorkItemId));
    const updated = await this.prisma.workLog.update({
      where: { id },
      data: {
        projectId: nextProjectId,
        secondaryWorkItemId: nextSecondaryWorkItemId,
        title: dto.title,
        description: dto.description,
        date,
        mode: dto.mode ? toWorkLogMode(dto.mode) : undefined,
        activityType: dto.activityType ? toActivityType(dto.activityType) : undefined,
        hours: dto.hours,
        entryTime: dto.entryTime === undefined ? undefined : dto.entryTime || null,
        exitTime: dto.exitTime === undefined ? undefined : dto.exitTime || null,
      },
      include: { project: true, secondaryWorkItem: true },
    });
    if (updated.secondaryWorkItemId) await this.secondaryWorkItems.touch(updated.secondaryWorkItemId, updated.updatedAt || updated.date);
    await this.audit.record(user, { action: 'UPDATE', module: 'WORK_LOGS', entityType: 'WorkLog', entityId: id, title: updated.title, detail: 'Parte diario editado' });
    return workLogToDto(updated);
  }
  private attendanceToDto(row: any) {
    return {
      id: row.id,
      employeeId: row.employeeId,
      date: formatDateOnlyArgentina(row.date),
      entryTime: row.entryTime || '',
      exitTime: row.exitTime || '',
      updatedAt: row.updatedAt?.toISOString?.() || '',
    };
  }

  async findAttendances(query: Record<string, string> = {}, user: JwtUser) {
    const where: any = {};
    if (user.role !== Role.ADMIN) where.employeeId = user.employeeId;
    else if (query.employeeId) where.employeeId = query.employeeId;
    if (query.date) {
      const { start, end } = dateOnlyToArgentinaDayRange(query.date);
      where.date = { gte: start, lt: end };
    }
    if (query.year) {
      const { start, end } = monthRangeArgentina(query.year, query.month);
      where.date = { gte: start, lt: end };
    }
    return (await this.prisma.dailyAttendance.findMany({ where, orderBy: { date: 'desc' } })).map((row) => this.attendanceToDto(row));
  }

  async saveAttendance(dto: SaveDailyAttendanceDto, user: JwtUser) {
    const employeeId = user.role === Role.ADMIN && dto.employeeId ? dto.employeeId : user.employeeId;
    if (!employeeId) throw new ForbiddenException();
    this.validateTimes(dto.entryTime, dto.exitTime);
    const date = toDate(dto.date)!;
    const { start, end } = dateOnlyToArgentinaDayRange(dto.date);
    const existing = await this.prisma.dailyAttendance.findFirst({ where: { employeeId, date: { gte: start, lt: end } } });
    const saved = existing
      ? await this.prisma.dailyAttendance.update({ where: { id: existing.id }, data: { entryTime: dto.entryTime || null, exitTime: dto.exitTime || null } })
      : await this.prisma.dailyAttendance.create({ data: { employeeId, date, entryTime: dto.entryTime || null, exitTime: dto.exitTime || null } });
    await this.audit.record(user, { action: 'UPSERT_ATTENDANCE', module: 'WORK_LOGS', entityType: 'DailyAttendance', entityId: saved.id, title: 'Horario de jornada actualizado' });
    return this.attendanceToDto(saved);
  }
  async remove(id: string, user: JwtUser) {
    const current = await this.prisma.workLog.findUnique({ where: { id } });
    if (!current) throw new NotFoundException();
    if (user.role !== Role.ADMIN && current.employeeId !== user.employeeId) throw new ForbiddenException();
    await this.prisma.workLog.update({ where: { id }, data: { deletedAt: new Date() } });
    return { status: 'success' };
  }
}
