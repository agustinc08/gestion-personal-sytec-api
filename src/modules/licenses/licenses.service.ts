import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LicenseStatus, Role } from '@prisma/client';
import { licenseToDto, toDate, toLicenseStatus } from '../../shared/mappers';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLicenseRequestDto } from './dto/create-license-request.dto';
import { UpdateLicenseRequestDto } from './dto/update-license-request.dto';

@Injectable()
export class LicensesService {
  constructor(private prisma: PrismaService) {}
  async findAll() { return (await this.prisma.licenseRequest.findMany({ where: { deletedAt: null }, orderBy: { dateRequested: 'desc' } })).map(licenseToDto); }
  async findMine(user: JwtUser) { return (await this.prisma.licenseRequest.findMany({ where: { employeeId: user.employeeId || '', deletedAt: null }, orderBy: { dateRequested: 'desc' } })).map(licenseToDto); }
  async rules() { return this.prisma.licenseRule.findMany({ orderBy: { article: 'asc' } }); }
  async create(dto: CreateLicenseRequestDto, user: JwtUser) {
    const employeeId = user.role === Role.ADMIN && dto.employeeId ? dto.employeeId : user.employeeId;
    if (!employeeId) throw new ForbiddenException();
    const status = user.role === Role.ADMIN && dto.status ? toLicenseStatus(dto.status) : LicenseStatus.PENDING;
    return licenseToDto(await this.prisma.licenseRequest.create({ data: {
      employeeId, article: dto.article, startDate: toDate(dto.startDate)!, endDate: toDate(dto.endDate)!,
      reason: dto.reason, certificateName: dto.certificateName, status,
    }}));
  }
  async update(id: string, dto: UpdateLicenseRequestDto, user: JwtUser) {
    const current = await this.prisma.licenseRequest.findUnique({ where: { id } });
    if (!current) throw new NotFoundException();
    if (user.role !== Role.ADMIN && current.employeeId !== user.employeeId) throw new ForbiddenException();
    return licenseToDto(await this.prisma.licenseRequest.update({ where: { id }, data: {
      article: dto.article, startDate: dto.startDate ? toDate(dto.startDate) : undefined, endDate: dto.endDate ? toDate(dto.endDate) : undefined,
      reason: dto.reason, certificateName: dto.certificateName, status: user.role === Role.ADMIN && dto.status ? toLicenseStatus(dto.status) : undefined,
    }}));
  }
  async approve(id: string) { return licenseToDto(await this.prisma.licenseRequest.update({ where: { id }, data: { status: LicenseStatus.APPROVED } })); }
  async reject(id: string) { return licenseToDto(await this.prisma.licenseRequest.update({ where: { id }, data: { status: LicenseStatus.REJECTED } })); }
}
