import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, SecondaryWorkItemStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { workLogToDto } from '../../shared/mappers';
import { CreateSecondaryWorkItemDto } from './dto/create-secondary-work-item.dto';
import { UpdateSecondaryWorkItemDto } from './dto/update-secondary-work-item.dto';

export function normalizeSecondaryWorkItemName(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

@Injectable()
export class SecondaryWorkItemsService {
  constructor(private prisma: PrismaService) {}

  toDto(item: any) {
    const workLogs = item.workLogs || [];
    const employees = new Map<string, string>();
    workLogs.forEach((log: any) => {
      if (log.employeeId) employees.set(log.employeeId, log.employee?.name || '');
    });
    const latestLog = workLogs[0];
    return {
      id: item.id,
      name: item.name,
      normalizedName: item.normalizedName,
      description: item.description || '',
      status: item.status,
      firstSeenAt: item.firstSeenAt?.toISOString?.() || '',
      lastActivityAt: (item.lastActivityAt || latestLog?.updatedAt || latestLog?.createdAt)?.toISOString?.() || '',
      createdAt: item.createdAt?.toISOString?.() || '',
      updatedAt: item.updatedAt?.toISOString?.() || '',
      createdById: item.createdById || '',
      lastEmployeeId: latestLog?.employeeId || '',
      lastEmployeeName: latestLog?.employee?.name || '',
      workLogsCount: item._count?.workLogs ?? workLogs.length,
      employeeNames: [...employees.values()].filter(Boolean),
      employeeIds: [...employees.keys()],
    };
  }

  includeSummary() {
    return {
      _count: { select: { workLogs: true } },
      workLogs: {
        where: { deletedAt: null },
        include: { employee: true, project: true },
        orderBy: [{ date: 'desc' as const }, { updatedAt: 'desc' as const }],
        take: 25,
      },
    };
  }

  async findAll() {
    const rows = await this.prisma.secondaryWorkItem.findMany({ include: this.includeSummary() });
    return rows.map((row) => this.toDto(row)).sort((a, b) => String(b.lastActivityAt || b.updatedAt || '').localeCompare(String(a.lastActivityAt || a.updatedAt || '')));
  }

  async findOrCreateByName(name: string, employeeId?: string | null) {
    const trimmed = (name || '').trim().replace(/\s+/g, ' ');
    const normalizedName = normalizeSecondaryWorkItemName(trimmed);
    if (!normalizedName) throw new BadRequestException('El nombre de la carga secundaria es obligatorio');
    const existing = await this.prisma.secondaryWorkItem.findUnique({ where: { normalizedName } });
    if (existing) return existing;
    return this.prisma.secondaryWorkItem.create({ data: { name: trimmed, normalizedName, createdById: employeeId || null } });
  }

  async create(dto: CreateSecondaryWorkItemDto, user: JwtUser) {
    const item = await this.findOrCreateByName(dto.name, user.employeeId);
    if (dto.description !== undefined) {
      return this.toDto(await this.prisma.secondaryWorkItem.update({ where: { id: item.id }, data: { description: dto.description || null }, include: this.includeSummary() }));
    }
    return this.toDto(await this.prisma.secondaryWorkItem.findUniqueOrThrow({ where: { id: item.id }, include: this.includeSummary() }));
  }

  async update(id: string, dto: UpdateSecondaryWorkItemDto, user: JwtUser) {
    if (user.role !== Role.ADMIN) throw new BadRequestException('Solo ADMIN puede modificar cargas secundarias');
    const current = await this.prisma.secondaryWorkItem.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Carga secundaria no encontrada');
    const name = dto.name?.trim().replace(/\s+/g, ' ');
    const data: any = {
      description: dto.description === undefined ? undefined : dto.description || null,
      status: dto.status,
    };
    if (name) {
      data.name = name;
      data.normalizedName = normalizeSecondaryWorkItemName(name);
    }
    return this.toDto(await this.prisma.secondaryWorkItem.update({ where: { id }, data, include: this.includeSummary() }));
  }

  async touch(id: string, date: Date) {
    await this.prisma.secondaryWorkItem.update({ where: { id }, data: { lastActivityAt: date } });
  }

  async workLogs(id: string) {
    const item = await this.prisma.secondaryWorkItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Carga secundaria no encontrada');
    return (await this.prisma.workLog.findMany({ where: { secondaryWorkItemId: id, deletedAt: null }, include: { project: true, secondaryWorkItem: true }, orderBy: [{ date: 'desc' }, { updatedAt: 'desc' }] })).map(workLogToDto);
  }
}
