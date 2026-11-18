import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LicenseStatus, Prisma, Role } from '@prisma/client';
import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { licenseToDto, toDate, toLicenseStatus } from '../../shared/mappers';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLicenseRequestDto } from './dto/create-license-request.dto';
import { UpdateLicenseRequestDto } from './dto/update-license-request.dto';
import { AuditService } from '../audit/audit.service';
import { assertCertificateAccess, validateCertificate } from './certificate-validation';
import { getConfiguredPageSize, paginate, paginationRequested } from '../../shared/pagination';
import { dateOnlyToArgentinaDayRange } from '../../shared/date-utils';

const FIERA_GUARD_LICENSE = 'Guardia en Feria';

function inclusiveDays(startDate: Date, endDate: Date) {
  return Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
}

function creditedDays(row: { article: string; status: LicenseStatus; deletedAt?: Date | null; startDate: Date; endDate: Date }) {
  return row.deletedAt || row.article !== FIERA_GUARD_LICENSE || row.status !== LicenseStatus.APPROVED
    ? 0
    : Math.max(1, inclusiveDays(row.startDate, row.endDate));
}

@Injectable()
export class LicensesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async findAll(query: Record<string, string> = {}) {
    return this.findRequests(this.listWhere(query), query);
  }

  async findMine(user: JwtUser, query: Record<string, string> = {}) {
    return this.findRequests({ ...this.listWhere(query), employeeId: user.employeeId || '' }, query);
  }

  private listWhere(query: Record<string, string>) {
    const where: any = { deletedAt: null };
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = toLicenseStatus(query.status);
    if (query.q?.trim()) {
      const contains = { contains: query.q.trim(), mode: 'insensitive' };
      where.OR = [
        { article: contains },
        { reason: contains },
        { employee: { is: { name: contains } } },
        { employee: { is: { dependency: contains } } },
      ];
    }
    if (query.from || query.to) where.startDate = { ...(query.from ? { gte: dateOnlyToArgentinaDayRange(query.from).start } : {}), ...(query.to ? { lt: dateOnlyToArgentinaDayRange(query.to).end } : {}) };
    return where;
  }

  private async findRequests(where: any, query: Record<string, string>) {
    const fetch = async (options?: { skip: number; take: number }) => (await this.prisma.licenseRequest.findMany({ where, orderBy: { dateRequested: 'desc' }, ...(options || {}) })).map(licenseToDto);
    if (!paginationRequested(query)) return fetch();
    return paginate(query, await getConfiguredPageSize(this.prisma), fetch, () => this.prisma.licenseRequest.count({ where }));
  }

  async rules() { return this.prisma.licenseRule.findMany({ orderBy: { article: 'asc' } }); }

  private dates(startValue: string, endValue: string) {
    const startDate = toDate(startValue);
    const endDate = toDate(endValue);
    if (!startDate || !endDate || startDate.getTime() > endDate.getTime()) {
      throw new BadRequestException('La fecha de inicio debe ser anterior o igual a la fecha de fin');
    }
    return { startDate, endDate };
  }

  private async assertNoOverlap(tx: Prisma.TransactionClient, employeeId: string, startDate: Date, endDate: Date, exceptId?: string) {
    const overlap = await tx.licenseRequest.findFirst({
      where: {
        employeeId,
        deletedAt: null,
        status: { in: [LicenseStatus.PENDING, LicenseStatus.APPROVED] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (overlap) throw new ConflictException('El período se superpone con otra solicitud pendiente o licencia aprobada');
  }

  private async applyCreditDelta(tx: Prisma.TransactionClient, before: any, after: any) {
    const delta = creditedDays(after) - creditedDays(before);
    if (!delta) return;
    const updated = await tx.employee.updateMany({
      where: { id: after.employeeId, ...(delta < 0 ? { compensatoryDays: { gte: -delta } } : {}) },
      data: { compensatoryDays: { increment: delta } },
    });
    if (!updated.count) throw new ConflictException('El saldo compensatorio no permite revertir esta acreditación');
  }

  async create(dto: CreateLicenseRequestDto, user: JwtUser) {
    const employeeId = user.role === Role.ADMIN && dto.employeeId ? dto.employeeId : user.employeeId;
    if (!employeeId) throw new ForbiddenException();
    const { startDate, endDate } = this.dates(dto.startDate, dto.endDate);
    const status = user.role === Role.ADMIN && dto.status ? toLicenseStatus(dto.status) : LicenseStatus.PENDING;
    const created = await this.prisma.$transaction(async (tx) => {
      await this.assertNoOverlap(tx, employeeId, startDate, endDate);
      const row = await tx.licenseRequest.create({ data: {
        employeeId, articleId: dto.articleId, article: dto.article, startDate, endDate,
        reason: dto.reason, status,
      } });
      await this.applyCreditDelta(tx, { ...row, status: LicenseStatus.PENDING }, row);
      return row;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.audit.record(user, { action: 'CREATE', module: 'LICENSES', entityType: 'LicenseRequest', entityId: created.id, title: created.article, detail: 'Solicitud de licencia creada', metadata: { after: { employeeId: created.employeeId, article: created.article, startDate, endDate, status } } });
    return licenseToDto(created);
  }

  async update(id: string, dto: UpdateLicenseRequestDto, user: JwtUser) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.licenseRequest.findFirst({ where: { id, deletedAt: null } });
      if (!current) throw new NotFoundException('Licencia no encontrada');
      if (user.role !== Role.ADMIN && current.employeeId !== user.employeeId) throw new ForbiddenException();
      if (user.role !== Role.ADMIN && current.status !== LicenseStatus.PENDING) {
        throw new ForbiddenException('No se puede editar una solicitud ya aprobada o rechazada');
      }

      const startDate = dto.startDate ? toDate(dto.startDate) : current.startDate;
      const endDate = dto.endDate ? toDate(dto.endDate) : current.endDate;
      if (!startDate || !endDate || startDate.getTime() > endDate.getTime()) {
        throw new BadRequestException('La fecha de inicio debe ser anterior o igual a la fecha de fin');
      }
      const article = dto.article ?? current.article;
      const status = user.role === Role.ADMIN && dto.status ? toLicenseStatus(dto.status) : current.status;
      await this.assertNoOverlap(tx, current.employeeId, startDate, endDate, id);

      const result = await tx.licenseRequest.updateMany({
        where: { id, deletedAt: null, updatedAt: current.updatedAt },
        data: {
          articleId: dto.articleId,
          article: dto.article,
          startDate: dto.startDate ? startDate : undefined,
          endDate: dto.endDate ? endDate : undefined,
          reason: dto.reason,
          status: user.role === Role.ADMIN && dto.status ? status : undefined,
        },
      });
      if (!result.count) throw new ConflictException('La licencia fue modificada por otra operación. Actualizá e intentá de nuevo.');
      const row = await tx.licenseRequest.findUniqueOrThrow({ where: { id } });
      await this.applyCreditDelta(tx, current, row);
      return { row, current };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await this.audit.record(user, { action: 'UPDATE', module: 'LICENSES', entityType: 'LicenseRequest', entityId: id, title: updated.row.article, detail: 'Solicitud de licencia editada', metadata: { before: { article: updated.current.article, startDate: updated.current.startDate, endDate: updated.current.endDate, status: updated.current.status }, after: { article: updated.row.article, startDate: updated.row.startDate, endDate: updated.row.endDate, status: updated.row.status } } });
    return licenseToDto(updated.row);
  }

  private async changeStatus(id: string, status: LicenseStatus, user: JwtUser) {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.licenseRequest.findFirst({ where: { id, deletedAt: null } });
      if (!current) throw new NotFoundException('Licencia no encontrada');
      if (current.status === status) return { row: current, current };
      const updatedCount = await tx.licenseRequest.updateMany({ where: { id, deletedAt: null, updatedAt: current.updatedAt }, data: { status } });
      if (!updatedCount.count) throw new ConflictException('La licencia fue modificada por otra operación. Actualizá e intentá de nuevo.');
      const row = await tx.licenseRequest.findUniqueOrThrow({ where: { id } });
      await this.applyCreditDelta(tx, current, row);
      return { row, current };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.audit.record(user, { action: status === LicenseStatus.APPROVED ? 'APPROVE' : 'REJECT', module: 'LICENSES', entityType: 'LicenseRequest', entityId: id, title: result.row.article, detail: status === LicenseStatus.APPROVED ? 'Licencia aprobada' : 'Licencia rechazada', metadata: { before: { status: result.current.status }, after: { status: result.row.status } } });
    return licenseToDto(result.row);
  }

  approve(id: string, user: JwtUser) { return this.changeStatus(id, LicenseStatus.APPROVED, user); }
  reject(id: string, user: JwtUser) { return this.changeStatus(id, LicenseStatus.REJECTED, user); }

  async remove(id: string, user: JwtUser) {
    const removed = await this.prisma.$transaction(async (tx) => {
      const current = await tx.licenseRequest.findFirst({ where: { id, deletedAt: null } });
      if (!current) throw new NotFoundException('Licencia no encontrada');
      if (user.role !== Role.ADMIN && current.employeeId !== user.employeeId) throw new ForbiddenException('No tenés permisos para eliminar esta solicitud');
      if (user.role !== Role.ADMIN && current.status !== LicenseStatus.PENDING) throw new ForbiddenException('No se puede eliminar una solicitud ya aprobada o rechazada');
      const result = await tx.licenseRequest.updateMany({ where: { id, deletedAt: null, updatedAt: current.updatedAt }, data: { deletedAt: new Date() } });
      if (!result.count) throw new ConflictException('La licencia fue modificada por otra operación. Actualizá e intentá de nuevo.');
      const row = { ...current, deletedAt: new Date() };
      await this.applyCreditDelta(tx, current, row);
      return current;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.audit.record(user, { action: 'DELETE', module: 'LICENSES', entityType: 'LicenseRequest', entityId: id, title: removed.article, detail: 'Solicitud de licencia eliminada', metadata: { before: { employeeId: removed.employeeId, article: removed.article, startDate: removed.startDate, endDate: removed.endDate, status: removed.status } } });
    return { status: 'success', message: 'Solicitud eliminada correctamente' };
  }

  async clear(user: JwtUser) {
    const count = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.licenseRequest.findMany({ where: { deletedAt: null } });
      for (const row of rows) await this.applyCreditDelta(tx, row, { ...row, deletedAt: new Date() });
      const result = await tx.licenseRequest.updateMany({ where: { deletedAt: null }, data: { deletedAt: new Date() } });
      return result.count;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.audit.record(user, { action: 'CLEAR', module: 'LICENSES', entityType: 'LicenseRequest', title: 'Solicitudes de licencia', detail: `${count} solicitudes archivadas` });
    return { status: 'success', count };
  }

  async uploadCertificate(id: string, file: any, user: JwtUser) {
    const current = await this.prisma.licenseRequest.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Licencia no encontrada');
    if (user.role !== Role.ADMIN && current.employeeId !== user.employeeId) throw new ForbiddenException();
    if (user.role !== Role.ADMIN && current.status !== LicenseStatus.PENDING) throw new ForbiddenException('Solo se puede adjuntar documentación a una solicitud pendiente');
    const { originalName, extension } = validateCertificate(file);
    const bytes: Buffer = file.buffer;

    const directory = join(process.cwd(), 'uploads', 'licenses');
    await mkdir(directory, { recursive: true });
    const storedName = `${id}-${randomUUID()}${extension}`;
    const destination = join(directory, storedName);
    const temporary = `${destination}.upload`;
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, destination);
    try {
      const storedReference = `${storedName}|${originalName}`;
      const updated = await this.prisma.licenseRequest.update({ where: { id }, data: { certificateName: storedReference } });
      if (current.certificateName) {
        const oldStoredName = current.certificateName.split('|', 1)[0];
        if (/^[A-Za-z0-9_-]+\.(?:pdf|jpg|jpeg|png)$/i.test(oldStoredName)) await unlink(join(directory, oldStoredName)).catch(() => undefined);
      }
      await this.audit.record(user, { action: 'ATTACH_CERTIFICATE', module: 'LICENSES', entityType: 'LicenseRequest', entityId: id, title: current.article, detail: 'Certificado adjuntado', metadata: { filename: originalName } });
      return licenseToDto(updated);
    } catch (error) {
      await unlink(destination).catch(() => undefined);
      throw error;
    }
  }

  async downloadCertificate(id: string, user: JwtUser) {
    const row = await this.prisma.licenseRequest.findFirst({ where: { id, deletedAt: null } });
    if (!row || !row.certificateName) throw new NotFoundException('Certificado no encontrado');
    assertCertificateAccess(row.employeeId, user);
    const [storedName, originalName] = row.certificateName.includes('|') ? row.certificateName.split('|', 2) : ['', row.certificateName];
    const extension = extname(originalName).toLowerCase();
    if (!['.pdf', '.jpg', '.jpeg', '.png'].includes(extension)) throw new NotFoundException('Certificado no encontrado');
    if (!/^[A-Za-z0-9_-]+\.(?:pdf|jpg|jpeg|png)$/i.test(storedName)) throw new NotFoundException('Certificado no encontrado');
    const path = join(process.cwd(), 'uploads', 'licenses', storedName);
    try {
      return { buffer: await readFile(path), filename: originalName, extension };
    } catch {
      throw new NotFoundException('El archivo del certificado no está disponible');
    }
  }
}
