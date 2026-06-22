import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LicenseStatus, Role } from '@prisma/client';
import { licenseToDto, toDate, toLicenseStatus } from '../../shared/mappers';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLicenseRequestDto } from './dto/create-license-request.dto';
import { UpdateLicenseRequestDto } from './dto/update-license-request.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class LicensesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}
  async findAll() { return (await this.prisma.licenseRequest.findMany({ where: { deletedAt: null }, orderBy: { dateRequested: 'desc' } })).map(licenseToDto); }
  async findMine(user: JwtUser) { return (await this.prisma.licenseRequest.findMany({ where: { employeeId: user.employeeId || '', deletedAt: null }, orderBy: { dateRequested: 'desc' } })).map(licenseToDto); }
  async rules() { return this.prisma.licenseRule.findMany({ orderBy: { article: 'asc' } }); }
  async create(dto: CreateLicenseRequestDto, user: JwtUser) {
    const employeeId = user.role === Role.ADMIN && dto.employeeId ? dto.employeeId : user.employeeId;
    if (!employeeId) throw new ForbiddenException();
    const status = user.role === Role.ADMIN && dto.status ? toLicenseStatus(dto.status) : LicenseStatus.PENDING;
    const created = await this.prisma.licenseRequest.create({ data: {
      employeeId, articleId: dto.articleId, article: dto.article, startDate: toDate(dto.startDate)!, endDate: toDate(dto.endDate)!,
      reason: dto.reason, certificateName: dto.certificateName, status,
    }});
    await this.audit.record(user, { action: 'CREATE', module: 'LICENSES', entityType: 'LicenseRequest', entityId: created.id, title: created.article, detail: 'Solicitud de licencia creada' });
    return licenseToDto(created);
  }
  async update(id: string, dto: UpdateLicenseRequestDto, user: JwtUser) {
    const current = await this.prisma.licenseRequest.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException();
    if (user.role !== Role.ADMIN && current.employeeId !== user.employeeId) throw new ForbiddenException();
    const updated = await this.prisma.licenseRequest.update({ where: { id }, data: {
      articleId: dto.articleId, article: dto.article, startDate: dto.startDate ? toDate(dto.startDate) : undefined, endDate: dto.endDate ? toDate(dto.endDate) : undefined,
      reason: dto.reason, certificateName: dto.certificateName, status: user.role === Role.ADMIN && dto.status ? toLicenseStatus(dto.status) : undefined,
    }});
    await this.audit.record(user, { action: 'UPDATE', module: 'LICENSES', entityType: 'LicenseRequest', entityId: id, title: updated.article, detail: 'Solicitud de licencia editada' });
    return licenseToDto(updated);
  }
  async approve(id: string, user: JwtUser) {
    const current = await this.prisma.licenseRequest.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Licencia no encontrada');
    const updated = await this.prisma.licenseRequest.update({ where: { id }, data: { status: LicenseStatus.APPROVED } });
    if (current.status !== LicenseStatus.APPROVED && current.article === 'Guardia en Feria') {
      const days = Math.max(1, Math.round((+current.endDate - +current.startDate) / 86400000) + 1);
      await this.prisma.employee.update({ where: { id: current.employeeId }, data: { compensatoryDays: { increment: days } } });
    }
    await this.audit.record(user, { action: 'APPROVE', module: 'LICENSES', entityType: 'LicenseRequest', entityId: id, title: updated.article, detail: 'Licencia aprobada' });
    return licenseToDto(updated);
  }
  async reject(id: string, user: JwtUser) {
    const current = await this.prisma.licenseRequest.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Licencia no encontrada');
    const updated = await this.prisma.licenseRequest.update({ where: { id }, data: { status: LicenseStatus.REJECTED } });
    await this.audit.record(user, { action: 'REJECT', module: 'LICENSES', entityType: 'LicenseRequest', entityId: id, title: updated.article, detail: 'Licencia rechazada' });
    return licenseToDto(updated);
  }
  async remove(id: string, user: JwtUser) {
    const current = await this.prisma.licenseRequest.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Licencia no encontrada');
    if (user.role !== Role.ADMIN && current.employeeId !== user.employeeId) throw new ForbiddenException('No tenés permisos para eliminar esta solicitud');
    if (user.role !== Role.ADMIN && current.status !== LicenseStatus.PENDING) throw new ForbiddenException('No se puede eliminar una solicitud ya aprobada o rechazada');
    await this.prisma.licenseRequest.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record(user, { action: 'DELETE', module: 'LICENSES', entityType: 'LicenseRequest', entityId: id, title: current.article, detail: 'Solicitud de licencia eliminada' });
    return { status: 'success', message: 'Solicitud eliminada correctamente' };
  }
  async clear() {
    const result = await this.prisma.licenseRequest.updateMany({ where: { deletedAt: null }, data: { deletedAt: new Date() } });
    return { status: 'success', count: result.count };
  }
}
