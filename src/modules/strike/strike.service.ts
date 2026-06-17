import { Injectable } from '@nestjs/common';
import { dateOnly, toDate } from '../../shared/mappers';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRemoteDayDto } from './dto/create-remote-day.dto';
import { UpdateStrikeConfigDto } from './dto/update-strike-config.dto';

@Injectable()
export class StrikeService {
  constructor(private prisma: PrismaService) {}
  async config() {
    const row = await this.prisma.strikeConfig.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });
    return { nextDate: dateOnly(row.nextDate), nextCoverEmployeeId: row.nextCoverEmployeeId || '', lastDate: dateOnly(row.lastDate), lastCoverEmployeeId: row.lastCoverEmployeeId || '', notes: row.notes || '' };
  }
  async updateConfig(dto: UpdateStrikeConfigDto) {
    const row = await this.prisma.strikeConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', nextDate: toDate(dto.nextDate), lastDate: toDate(dto.lastDate), nextCoverEmployeeId: dto.nextCoverEmployeeId, lastCoverEmployeeId: dto.lastCoverEmployeeId, notes: dto.notes },
      update: { nextDate: dto.nextDate ? toDate(dto.nextDate) : null, lastDate: dto.lastDate ? toDate(dto.lastDate) : null, nextCoverEmployeeId: dto.nextCoverEmployeeId, lastCoverEmployeeId: dto.lastCoverEmployeeId, notes: dto.notes },
    });
    return { nextDate: dateOnly(row.nextDate), nextCoverEmployeeId: row.nextCoverEmployeeId || '', lastDate: dateOnly(row.lastDate), lastCoverEmployeeId: row.lastCoverEmployeeId || '', notes: row.notes || '' };
  }
  remoteDays() { return this.prisma.remoteDay.findMany({ orderBy: { createdAt: 'desc' } }); }
  createRemoteDay(dto: CreateRemoteDayDto) { return this.prisma.remoteDay.create({ data: { employeeId: dto.employeeId, day: dto.day, date: dto.date ? toDate(dto.date) : undefined } }); }
  async deleteRemoteDay(id: string) { await this.prisma.remoteDay.delete({ where: { id } }); return { status: 'success' }; }
}
