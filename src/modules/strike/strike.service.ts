import { Injectable } from '@nestjs/common';
import { dateOnly, toDate } from '../../shared/mappers';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRemoteDayDto } from './dto/create-remote-day.dto';
import { UpdateStrikeConfigDto } from './dto/update-strike-config.dto';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class StrikeService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}
  async config() {
    const row = await this.prisma.strikeConfig.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });
    return { nextDate: dateOnly(row.nextDate), nextCoverEmployeeId: row.nextCoverEmployeeId || '', lastDate: dateOnly(row.lastDate), lastCoverEmployeeId: row.lastCoverEmployeeId || '', notes: row.notes || '' };
  }
  async updateConfig(dto: UpdateStrikeConfigDto, user: JwtUser) {
    const previous = await this.prisma.strikeConfig.findUnique({ where: { id: 'default' } });
    const row = await this.prisma.strikeConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', nextDate: toDate(dto.nextDate), lastDate: toDate(dto.lastDate), nextCoverEmployeeId: dto.nextCoverEmployeeId, lastCoverEmployeeId: dto.lastCoverEmployeeId, notes: dto.notes },
      update: { nextDate: dto.nextDate ? toDate(dto.nextDate) : null, lastDate: dto.lastDate ? toDate(dto.lastDate) : null, nextCoverEmployeeId: dto.nextCoverEmployeeId, lastCoverEmployeeId: dto.lastCoverEmployeeId, notes: dto.notes },
    });
    const before = { nextDate: dateOnly(previous?.nextDate), nextCoverEmployeeId: previous?.nextCoverEmployeeId || '', lastDate: dateOnly(previous?.lastDate), lastCoverEmployeeId: previous?.lastCoverEmployeeId || '', notes: previous?.notes || '' };
    const after = { nextDate: dateOnly(row.nextDate), nextCoverEmployeeId: row.nextCoverEmployeeId || '', lastDate: dateOnly(row.lastDate), lastCoverEmployeeId: row.lastCoverEmployeeId || '', notes: row.notes || '' };
    if (JSON.stringify(before) !== JSON.stringify(after)) await this.audit.record(user, { action: 'UPDATE', module: 'STRIKE', entityType: 'StrikeConfig', entityId: 'default', title: 'Configuración de paro actualizada', detail: 'Configuración de fecha, guardia u observaciones modificada', metadata: { before, after } });
    return { nextDate: dateOnly(row.nextDate), nextCoverEmployeeId: row.nextCoverEmployeeId || '', lastDate: dateOnly(row.lastDate), lastCoverEmployeeId: row.lastCoverEmployeeId || '', notes: row.notes || '' };
  }
  remoteDays(user: JwtUser) {
    const where = user.role === Role.ADMIN ? {} : { employeeId: user.employeeId || '__unassigned_employee__' };
    return this.prisma.remoteDay.findMany({ where, orderBy: { createdAt: 'desc' } });
  }
  async createRemoteDay(dto: CreateRemoteDayDto, user: JwtUser) {
    const row = await this.prisma.remoteDay.create({ data: { employeeId: dto.employeeId, day: dto.day, date: dto.date ? toDate(dto.date) : undefined } });
    await this.audit.record(user, { action: 'CREATE', module: 'REMOTE_DAYS', entityType: 'RemoteDay', entityId: row.id, title: row.day, detail: 'Registro de modalidad remota creado', metadata: { after: { employeeId: row.employeeId, day: row.day, date: row.date } } });
    return row;
  }
  async deleteRemoteDay(id: string, user: JwtUser) {
    const row = await this.prisma.remoteDay.findUnique({ where: { id } });
    if (!row) return { status: 'success' };
    await this.prisma.remoteDay.delete({ where: { id } });
    await this.audit.record(user, { action: 'DELETE', module: 'REMOTE_DAYS', entityType: 'RemoteDay', entityId: id, title: row.day, detail: 'Registro de modalidad remota eliminado', metadata: { before: { employeeId: row.employeeId, day: row.day, date: row.date } } });
    return { status: 'success' };
  }
}
