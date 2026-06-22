import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

export type AuditInput = {
  action: string; module: string; entityType?: string; entityId?: string;
  title?: string; detail?: string; metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(user: JwtUser | null | undefined, input: AuditInput) {
    try {
      await this.prisma.auditLog.create({ data: {
        userId: user?.id, employeeId: user?.employeeId, action: input.action, module: input.module,
        entity: input.entityType || input.module, entityType: input.entityType, entityId: input.entityId,
        title: input.title, detail: input.detail, metadata: input.metadata,
      } });
    } catch {
      // La auditoría nunca debe interrumpir la operación principal.
    }
  }

  async findAll(query: Record<string, string>) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = [10, 25, 50].includes(Number(query.pageSize)) ? Number(query.pageSize) : 10;
    const where: Prisma.AuditLogWhereInput = {};
    if (query.userId) where.userId = query.userId;
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.module) where.module = query.module;
    if (query.action) where.action = query.action;
    if (query.from || query.to) where.createdAt = { ...(query.from ? { gte: new Date(`${query.from}T00:00:00`) } : {}), ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999`) } : {}) };
    if (query.q) where.OR = ['title', 'detail', 'entity', 'action', 'module'].map((field) => ({ [field]: { contains: query.q, mode: 'insensitive' } })) as Prisma.AuditLogWhereInput[];
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, include: { user: { select: { cuil: true, email: true } }, employee: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findOne(id: string) {
    const row = await this.prisma.auditLog.findUnique({ where: { id }, include: { user: { select: { cuil: true, email: true } }, employee: { select: { name: true } } } });
    if (!row) throw new NotFoundException('Registro de auditoría no encontrado');
    return row;
  }
}
