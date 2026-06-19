import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LicenseStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { employeeToDto, toRole } from '../../shared/mappers';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  private cleanCuil(cuil: string) {
    return cuil.replace(/\D/g, '');
  }

  async findAll() {
    const rows = await this.prisma.employee.findMany({
      where: { deletedAt: null },
      include: { user: true, remoteDays: true, licenseRequests: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(employeeToDto);
  }

  async findOne(id: string, user?: JwtUser) {
    if (user?.role !== Role.ADMIN && user?.employeeId !== id) throw new ForbiddenException();
    const row = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      include: { user: true, remoteDays: true, licenseRequests: true },
    });
    if (!row) throw new NotFoundException('Empleado no encontrado');
    return employeeToDto(row);
  }

  async findMe(user: JwtUser) {
    if (!user.employeeId) throw new NotFoundException('Usuario sin empleado asociado');
    return this.findOne(user.employeeId, user);
  }

  async create(dto: CreateEmployeeDto) {
    const cuil = this.cleanCuil(dto.cuil);
    const password = dto.password || dto.cuil || 'Temporal123';
    const employee = await this.prisma.employee.create({
      data: {
        name: dto.name,
        email: dto.email,
        avatar: dto.avatar,
        dependency: dto.dependency,
        position: dto.position,
        cuil,
        totalLicenseDays: dto.totalLicenseDays || 0,
        strikeDutyOrder: dto.strikeDutyOrder ?? -1,
        remoteDays: { create: (dto.remoteDaysAssigned || []).map((day) => ({ day })) },
      },
    });
    await this.prisma.user.create({
      data: {
        cuil,
        email: dto.email,
        passwordHash: await bcrypt.hash(password, 10),
        role: toRole(dto.isAdmin),
        mustChangePassword: dto.mustChangePassword ?? true,
        employeeId: employee.id,
      },
    });
    return this.findOne(employee.id, { id: '', cuil: '', email: '', role: Role.ADMIN });
  }

  async update(id: string, dto: UpdateEmployeeDto, user?: JwtUser) {
    const isAdmin = user?.role === Role.ADMIN;
    if (!isAdmin && user?.employeeId !== id) throw new ForbiddenException();
    const current = await this.prisma.employee.findFirst({ where: { id, deletedAt: null }, include: { user: true } });
    if (!current) throw new NotFoundException('Empleado no encontrado');
    await this.prisma.employee.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        avatar: dto.avatar,
        dependency: dto.dependency,
        position: dto.position,
        cuil: isAdmin && dto.cuil ? this.cleanCuil(dto.cuil) : undefined,
        totalLicenseDays: isAdmin ? dto.totalLicenseDays : undefined,
        strikeDutyOrder: isAdmin ? dto.strikeDutyOrder : undefined,
      },
    });
    if (isAdmin && dto.remoteDaysAssigned) {
      await this.prisma.remoteDay.deleteMany({ where: { employeeId: id } });
      await this.prisma.remoteDay.createMany({ data: dto.remoteDaysAssigned.map((day) => ({ employeeId: id, day })), skipDuplicates: true });
    }
    if (current.user) {
      await this.prisma.user.update({
        where: { id: current.user.id },
        data: {
          email: dto.email,
          cuil: isAdmin && dto.cuil ? this.cleanCuil(dto.cuil) : undefined,
          role: isAdmin && dto.isAdmin !== undefined ? toRole(dto.isAdmin) : undefined,
          mustChangePassword: isAdmin ? dto.mustChangePassword : undefined,
          passwordHash: isAdmin && dto.password ? await bcrypt.hash(dto.password, 10) : undefined,
        },
      });
    }
    return this.findOne(id, { id: '', cuil: '', email: '', role: Role.ADMIN });
  }

  async remove(id: string) {
    await this.prisma.employee.update({ where: { id }, data: { deletedAt: new Date(), user: { update: { deletedAt: new Date() } } } });
    return { status: 'success' };
  }

  async updateAvatar(id: string, file: any, user: JwtUser) {
    const isAdmin = user.role === Role.ADMIN;
    if (!isAdmin && user.employeeId !== id) throw new ForbiddenException();
    const current = await this.prisma.employee.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Empleado no encontrado');
    if (!file) throw new BadRequestException('Archivo requerido');

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) throw new BadRequestException('Solo se permiten imagenes JPG, PNG o WEBP');

    const extension = extname(file.originalname || '').toLowerCase();
    const safeExtension = extension === '.jpeg' ? '.jpg' : extension;
    if (!['.jpg', '.png', '.webp'].includes(safeExtension)) throw new BadRequestException('Extension de imagen invalida');

    const uploadDir = join(process.cwd(), 'uploads', 'avatars');
    await mkdir(uploadDir, { recursive: true });
    const filename = `${id}-${Date.now()}${safeExtension}`;
    await writeFile(join(uploadDir, filename), file.buffer);

    const avatar = `/uploads/avatars/${filename}`;
    await this.prisma.employee.update({ where: { id }, data: { avatar } });
    return this.findOne(id, { id: user.id, cuil: user.cuil, email: user.email, role: Role.ADMIN });
  }

  async resetGuardias(id: string) {
    const current = await this.prisma.employee.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Empleado no encontrado');
    await this.prisma.licenseRequest.updateMany({
      where: { employeeId: id, article: 'Guardia en Feria', status: LicenseStatus.APPROVED, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return this.findOne(id, { id: '', cuil: '', email: '', role: Role.ADMIN });
  }
}
