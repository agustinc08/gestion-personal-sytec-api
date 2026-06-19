import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { toActivityType, toDate, toWorkLogMode, workLogToDto } from '../../shared/mappers';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkLogDto } from './dto/create-work-log.dto';
import { UpdateWorkLogDto } from './dto/update-work-log.dto';

@Injectable()
export class WorkLogsService {
  constructor(private prisma: PrismaService) {}

  private where(query: Record<string, string> = {}, employeeId?: string) {
    const where: any = { deletedAt: null };
    if (employeeId || query.employeeId) where.employeeId = employeeId || query.employeeId;
    if (query.projectId) where.projectId = query.projectId;
    if (query.activityType) where.activityType = toActivityType(query.activityType);
    if (query.mode) where.mode = toWorkLogMode(query.mode);
    if (query.year) {
      const year = Number(query.year);
      const month = query.month ? Number(query.month) - 1 : 0;
      const from = new Date(year, month, 1);
      const to = query.month ? new Date(year, month + 1, 0, 23, 59, 59, 999) : new Date(year, 11, 31, 23, 59, 59, 999);
      where.date = { gte: from, lte: to };
    }
    return where;
  }

  async findAll(query: Record<string, string> = {}) {
    return (await this.prisma.workLog.findMany({ where: this.where(query), include: { project: true }, orderBy: { date: 'desc' } })).map(workLogToDto);
  }
  async findMine(user: JwtUser, query: Record<string, string> = {}) {
    return (await this.prisma.workLog.findMany({ where: this.where(query, user.employeeId || ''), include: { project: true }, orderBy: { date: 'desc' } })).map(workLogToDto);
  }
  async create(dto: CreateWorkLogDto, user: JwtUser) {
    const employeeId = user.role === Role.ADMIN && dto.employeeId ? dto.employeeId : user.employeeId;
    if (!employeeId) throw new ForbiddenException();
    return workLogToDto(await this.prisma.workLog.create({
      data: {
        employeeId,
        projectId: dto.projectId || null,
        title: dto.title,
        description: dto.description,
        date: toDate(dto.date)!,
        mode: toWorkLogMode(dto.mode),
        activityType: toActivityType(dto.activityType),
        hours: dto.hours,
      },
      include: { project: true },
    }));
  }
  async update(id: string, dto: UpdateWorkLogDto, user: JwtUser) {
    const current = await this.prisma.workLog.findUnique({ where: { id } });
    if (!current) throw new NotFoundException();
    if (user.role !== Role.ADMIN && current.employeeId !== user.employeeId) throw new ForbiddenException();
    return workLogToDto(await this.prisma.workLog.update({
      where: { id },
      data: {
        projectId: dto.projectId === '' ? null : dto.projectId,
        title: dto.title,
        description: dto.description,
        date: dto.date ? toDate(dto.date) : undefined,
        mode: dto.mode ? toWorkLogMode(dto.mode) : undefined,
        activityType: dto.activityType ? toActivityType(dto.activityType) : undefined,
        hours: dto.hours,
      },
      include: { project: true },
    }));
  }
  async remove(id: string, user: JwtUser) {
    const current = await this.prisma.workLog.findUnique({ where: { id } });
    if (!current) throw new NotFoundException();
    if (user.role !== Role.ADMIN && current.employeeId !== user.employeeId) throw new ForbiddenException();
    await this.prisma.workLog.update({ where: { id }, data: { deletedAt: new Date() } });
    return { status: 'success' };
  }
}
