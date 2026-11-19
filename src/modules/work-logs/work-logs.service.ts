import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { toActivityType, toDate, toWorkLogMode, workLogToDto } from '../../shared/mappers';
import { addDateOnlyDays, dateOnlyToArgentinaDayRange, formatDateOnlyArgentina, getArgentinaTodayDateOnly, monthRangeArgentina, parseArgentinaDateOnly } from '../../shared/date-utils';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkLogDto } from './dto/create-work-log.dto';
import { UpdateWorkLogDto } from './dto/update-work-log.dto';
import { SaveDailyAttendanceDto } from './dto/save-daily-attendance.dto';
import { AuditService } from '../audit/audit.service';
import { SecondaryWorkItemsService } from '../secondary-work-items/secondary-work-items.service';
import { getWorkdayStatus } from '../../shared/workday';
import { getConfiguredPageSize, paginate, paginationRequested } from '../../shared/pagination';

export function isEmployeeWorkLogDateEditable(value: Date | string, today = getArgentinaTodayDateOnly()): boolean {
  const date = value instanceof Date ? formatDateOnlyArgentina(value) : parseArgentinaDateOnly(value);
  return !!date && date >= addDateOnlyDays(today, -6) && date <= today;
}

@Injectable()
export class WorkLogsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private secondaryWorkItems: SecondaryWorkItemsService) {}

  private async assertProjectAccess(projectId: string | null | undefined, user: JwtUser) {
    if (!projectId || user.role === Role.ADMIN) return;
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null, assignedEmployees: { some: { id: user.employeeId || '' } } },
      select: { id: true },
    });
    if (!project) throw new ForbiddenException('No estás asignado a este proyecto');
  }

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
    if (query.from || query.to) where.date = { ...(where.date || {}), ...(query.from ? { gte: dateOnlyToArgentinaDayRange(query.from).start } : {}), ...(query.to ? { lt: dateOnlyToArgentinaDayRange(query.to).end } : {}) };
    if (query.status === 'active') where.deletedAt = null;
    if (query.year) {
      const { start, end } = monthRangeArgentina(query.year, query.month);
      where.date = { gte: start, lt: end };
    }
    return where;
  }

  async findAll(query: Record<string, string> = {}) {
    return this.findWorkLogs(this.where(query), query);
  }
  async findMine(user: JwtUser, query: Record<string, string> = {}) {
    return this.findWorkLogs(this.where(query, user.employeeId || ''), query);
  }
  private async findWorkLogs(where: any, query: Record<string, string>) {
    const fetch = async (options?: { skip: number; take: number }) => (await this.prisma.workLog.findMany({ where, include: { project: true, secondaryWorkItem: true }, orderBy: { date: 'desc' }, ...(options || {}) })).map(workLogToDto);
    if (!paginationRequested(query)) return fetch();
    return paginate(query, await getConfiguredPageSize(this.prisma), (options) => fetch(options), () => this.prisma.workLog.count({ where }));
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
    await this.assertProjectAccess(dto.projectId, user);
    this.validateTimes(dto.entryTime, dto.exitTime);
    let mode = toWorkLogMode(dto.mode);
    if (user.role !== Role.ADMIN && formatDateOnlyArgentina(date) >= getArgentinaTodayDateOnly()) {
      const [employee, strike] = await Promise.all([
        this.prisma.employee.findUnique({ where: { id: employeeId }, include: { remoteDays: { where: { date: null } } } }),
        this.prisma.strikeConfig.findUnique({ where: { id: 'default' } }),
      ]);
      const status = getWorkdayStatus({ date: dto.date, remoteDays: employee?.remoteDays.map((row) => row.day), strikeDate: strike?.nextDate });
      if (status === 'REMOTE') mode = toWorkLogMode('remoto');
      if (status === 'PRESENTIAL') mode = toWorkLogMode('presencial');
    }
    const secondaryWorkItem = await this.resolveSecondaryWorkItem(dto, employeeId);
    const created = await this.prisma.workLog.create({
      data: {
        employeeId,
        projectId: dto.projectId || null,
        secondaryWorkItemId: dto.projectId ? null : secondaryWorkItem?.id || null,
        title: dto.title,
        description: dto.description,
        date,
        mode,
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
    const current = await this.prisma.workLog.findFirst({ where: { id, deletedAt: null }, include: { project: true, secondaryWorkItem: true } });
    if (!current) throw new NotFoundException();
    if (user.role !== Role.ADMIN && current.employeeId !== user.employeeId) throw new ForbiddenException();
    if (user.role !== Role.ADMIN && !isEmployeeWorkLogDateEditable(current.date)) {
      throw new BadRequestException('Solo podés corregir partes de los últimos 7 días.');
    }
    if (user.role === Role.ADMIN && formatDateOnlyArgentina(current.date) < getArgentinaTodayDateOnly() && !dto.reason?.trim()) {
      throw new BadRequestException('Indicá el motivo para modificar un parte histórico');
    }
    const normalizedTargetDate = dto.date === undefined ? formatDateOnlyArgentina(current.date) : parseArgentinaDateOnly(dto.date);
    if (!normalizedTargetDate) throw new BadRequestException('La fecha del parte no es válida');
    if (user.role !== Role.ADMIN && !isEmployeeWorkLogDateEditable(normalizedTargetDate)) {
      throw new BadRequestException('Solo podés corregir partes de los últimos 7 días.');
    }
    const date = dto.date === undefined ? current.date : toDate(normalizedTargetDate);
    if (!date) throw new BadRequestException('La fecha del parte no es válida');
    const nextEntryTime = dto.entryTime === undefined ? current.entryTime || undefined : dto.entryTime || undefined;
    const nextExitTime = dto.exitTime === undefined ? current.exitTime || undefined : dto.exitTime || undefined;
    this.validateTimes(nextEntryTime, nextExitTime);
    const nextProjectId = dto.projectId === undefined ? current.projectId : dto.projectId || null;
    await this.assertProjectAccess(nextProjectId, user);
    let nextSecondaryWorkItemId = current.secondaryWorkItemId;
    if (nextProjectId) nextSecondaryWorkItemId = null;
    else if (dto.secondaryWorkItemId !== undefined || dto.secondaryWorkItemName !== undefined) {
      const secondaryWorkItem = await this.resolveSecondaryWorkItem(dto, current.employeeId);
      nextSecondaryWorkItemId = secondaryWorkItem?.id ?? null;
    } else if (user.role === Role.ADMIN) {
      const secondaryWorkItem = await this.resolveSecondaryWorkItem({ ...dto, title: dto.title || current.title }, current.employeeId);
      nextSecondaryWorkItemId = secondaryWorkItem?.id ?? current.secondaryWorkItemId;
    }
    const nextTitle = dto.title ?? current.title;
    const nextDescription = dto.description ?? current.description;
    const nextMode = dto.mode ? toWorkLogMode(dto.mode) : current.mode;
    const nextActivityType = dto.activityType ? toActivityType(dto.activityType) : current.activityType;
    const nextHours = dto.hours === undefined ? current.hours : dto.hours;
    const nextEntryTimeValue = dto.entryTime === undefined ? current.entryTime : dto.entryTime || null;
    const nextExitTimeValue = dto.exitTime === undefined ? current.exitTime : dto.exitTime || null;
    const unchanged = formatDateOnlyArgentina(date) === formatDateOnlyArgentina(current.date)
      && nextProjectId === current.projectId
      && nextSecondaryWorkItemId === current.secondaryWorkItemId
      && nextTitle === current.title
      && nextDescription === current.description
      && nextMode === current.mode
      && nextActivityType === current.activityType
      && nextHours === current.hours
      && nextEntryTimeValue === current.entryTime
      && nextExitTimeValue === current.exitTime;
    if (unchanged) return workLogToDto(current);
    const updated = await this.prisma.workLog.update({
      where: { id },
      data: {
        projectId: nextProjectId,
        secondaryWorkItemId: nextSecondaryWorkItemId,
        title: nextTitle,
        description: nextDescription,
        date,
        mode: nextMode,
        activityType: nextActivityType,
        hours: nextHours,
        entryTime: nextEntryTimeValue,
        exitTime: nextExitTimeValue,
      },
      include: { project: true, secondaryWorkItem: true },
    });
    if (updated.secondaryWorkItemId) await this.secondaryWorkItems.touch(updated.secondaryWorkItemId, updated.updatedAt || updated.date);
    const employeeEdit = user.role !== Role.ADMIN;
    const snapshot = (row: typeof current) => ({ employeeId: row.employeeId, date: formatDateOnlyArgentina(row.date), title: row.title, description: row.description, projectId: row.projectId, secondaryWorkItemId: row.secondaryWorkItemId, mode: row.mode, activityType: row.activityType, hours: row.hours, entryTime: row.entryTime, exitTime: row.exitTime });
    await this.audit.record(user, { action: employeeEdit ? 'WORKLOG_UPDATED_BY_EMPLOYEE' : 'UPDATE', module: 'WORK_LOGS', entityType: 'WorkLog', entityId: id, title: updated.title, detail: employeeEdit ? 'Parte diario corregido por empleado' : dto.reason?.trim() || 'Parte diario editado', metadata: { reason: employeeEdit ? null : dto.reason?.trim() || null, before: snapshot(current), after: snapshot(updated) } });
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
    const fetch = async (options?: { skip: number; take: number }) => (await this.prisma.dailyAttendance.findMany({ where, orderBy: { date: 'desc' }, ...(options || {}) })).map((row) => this.attendanceToDto(row));
    if (!paginationRequested(query)) return fetch();
    return paginate(query, await getConfiguredPageSize(this.prisma), (options) => fetch(options), () => this.prisma.dailyAttendance.count({ where }));
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
  async remove(id: string, user: JwtUser, reason?: string) {
    const current = await this.prisma.workLog.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException();
    if (user.role !== Role.ADMIN && current.employeeId !== user.employeeId) throw new ForbiddenException();
    if (user.role === Role.ADMIN && formatDateOnlyArgentina(current.date) < getArgentinaTodayDateOnly() && !reason?.trim()) {
      throw new BadRequestException('Indicá el motivo para eliminar un parte histórico');
    }
    await this.prisma.workLog.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record(user, { action: 'DELETE', module: 'WORK_LOGS', entityType: 'WorkLog', entityId: id, title: current.title, detail: reason?.trim() || 'Parte diario eliminado', metadata: { reason: reason?.trim() || null, before: { employeeId: current.employeeId, date: formatDateOnlyArgentina(current.date), title: current.title, description: current.description, projectId: current.projectId, mode: current.mode, hours: current.hours } } });
    return { status: 'success' };
  }
}
