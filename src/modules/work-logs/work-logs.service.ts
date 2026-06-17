import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { toDate, toWorkLogMode, workLogToDto } from '../../shared/mappers';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkLogDto } from './dto/create-work-log.dto';
import { UpdateWorkLogDto } from './dto/update-work-log.dto';

@Injectable()
export class WorkLogsService {
  constructor(private prisma: PrismaService) {}
  async findAll() { return (await this.prisma.workLog.findMany({ where: { deletedAt: null }, orderBy: { date: 'desc' } })).map(workLogToDto); }
  async findMine(user: JwtUser) { return (await this.prisma.workLog.findMany({ where: { employeeId: user.employeeId || '', deletedAt: null }, orderBy: { date: 'desc' } })).map(workLogToDto); }
  async create(dto: CreateWorkLogDto, user: JwtUser) {
    const employeeId = user.role === Role.ADMIN && dto.employeeId ? dto.employeeId : user.employeeId;
    if (!employeeId) throw new ForbiddenException();
    return workLogToDto(await this.prisma.workLog.create({ data: { employeeId, title: dto.title, description: dto.description, date: toDate(dto.date)!, mode: toWorkLogMode(dto.mode) } }));
  }
  async update(id: string, dto: UpdateWorkLogDto, user: JwtUser) {
    const current = await this.prisma.workLog.findUnique({ where: { id } });
    if (!current) throw new NotFoundException();
    if (user.role !== Role.ADMIN && current.employeeId !== user.employeeId) throw new ForbiddenException();
    return workLogToDto(await this.prisma.workLog.update({ where: { id }, data: { title: dto.title, description: dto.description, date: dto.date ? toDate(dto.date) : undefined, mode: dto.mode ? toWorkLogMode(dto.mode) : undefined } }));
  }
  async remove(id: string, user: JwtUser) {
    const current = await this.prisma.workLog.findUnique({ where: { id } });
    if (!current) throw new NotFoundException();
    if (user.role !== Role.ADMIN && current.employeeId !== user.employeeId) throw new ForbiddenException();
    await this.prisma.workLog.update({ where: { id }, data: { deletedAt: new Date() } });
    return { status: 'success' };
  }
}
