import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { employeeToDto, toRole } from '../../shared/mappers';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private cleanCuil(cuil: string) {
    return cuil.replace(/\D/g, '');
  }

  async findAll() {
    const rows = await this.prisma.employee.findMany({
      where: { deletedAt: null },
      include: { user: true, remoteDays: true, licenseRequests: true, dependencyRef: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(employeeToDto);
  }

  async findOne(id: string, user?: JwtUser) {
    if (user?.role !== Role.ADMIN && user?.employeeId !== id) throw new ForbiddenException();
    const row = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      include: { user: true, remoteDays: true, licenseRequests: true, dependencyRef: true },
    });
    if (!row) throw new NotFoundException('Empleado no encontrado');
    return employeeToDto(row);
  }

  async findMe(user: JwtUser) {
    if (!user.employeeId) throw new NotFoundException('Usuario sin empleado asociado');
    return this.findOne(user.employeeId, user);
  }

  async updateMe(user: JwtUser, dto: UpdateMyProfileDto) {
    if (!user.employeeId) throw new NotFoundException('Usuario sin empleado asociado');
    const current = await this.prisma.employee.findFirst({ where: { id: user.employeeId, deletedAt: null }, include: { user: true } });
    if (!current) throw new NotFoundException('Empleado no encontrado');

    const name = dto.name?.trim();
    const email = dto.email?.trim();
    const avatar = dto.avatar?.trim();

    await this.prisma.employee.update({
      where: { id: current.id },
      data: {
        name: name || undefined,
        email: email ?? undefined,
        avatar: avatar || undefined,
      },
    });

    const profilePassword = dto.password?.trim();
    if (current.user) {
      await this.prisma.user.update({
        where: { id: current.user.id },
        data: {
          email: email ?? undefined,
          passwordHash: profilePassword ? await bcrypt.hash(profilePassword, 10) : undefined,
        },
      });
    }

    await this.audit.record(user, { action: 'UPDATE', module: 'EMPLOYEES', entityType: 'Employee', entityId: current.id, title: name || current.name, detail: 'Perfil propio actualizado' });
    return this.findOne(current.id, { id: '', cuil: '', email: '', role: Role.ADMIN });
  }

  async create(dto: CreateEmployeeDto, user: JwtUser) {
    const cuil = this.cleanCuil(dto.cuil);
    const password = dto.password || dto.cuil || 'Temporal123';
    const dependency = dto.dependencyId
      ? await this.prisma.dependency.findFirst({ where: { id: dto.dependencyId, deletedAt: null, isActive: true } })
      : dto.dependency ? await this.prisma.dependency.findFirst({ where: { name: { equals: dto.dependency.trim(), mode: 'insensitive' }, deletedAt: null } }) : null;
    if (dto.dependencyId && !dependency) throw new BadRequestException('Dependencia inválida o inactiva');
    const dependencyName = dependency?.name || dto.dependency?.trim() || 'Sin dependencia';
    const employee = await this.prisma.employee.create({
      data: {
        name: dto.name,
        email: dto.email,
        avatar: dto.avatar,
        dependency: dependencyName,
        dependencyId: dependency?.id,
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
    await this.audit.record(user, { action: 'CREATE', module: 'EMPLOYEES', entityType: 'Employee', entityId: employee.id, title: employee.name, detail: 'Empleado creado' });
    return this.findOne(employee.id, { id: '', cuil: '', email: '', role: Role.ADMIN });
  }

  async update(id: string, dto: UpdateEmployeeDto, user?: JwtUser) {
    const isAdmin = user?.role === Role.ADMIN;
    if (!isAdmin && user?.employeeId !== id) throw new ForbiddenException();
    const current = await this.prisma.employee.findFirst({ where: { id, deletedAt: null }, include: { user: true } });
    if (!current) throw new NotFoundException('Empleado no encontrado');
    const dependency = isAdmin && dto.dependencyId
      ? await this.prisma.dependency.findFirst({ where: { id: dto.dependencyId, deletedAt: null, isActive: true } })
      : null;
    if (isAdmin && dto.dependencyId && !dependency) throw new BadRequestException('Dependencia inválida o inactiva');
    await this.prisma.employee.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        avatar: isAdmin ? dto.avatar : undefined,
        dependency: isAdmin ? dependency?.name || dto.dependency : undefined,
        dependencyId: isAdmin ? dependency?.id : undefined,
        position: isAdmin ? dto.position : undefined,
        cuil: isAdmin && dto.cuil ? this.cleanCuil(dto.cuil) : undefined,
        totalLicenseDays: isAdmin ? dto.totalLicenseDays : undefined,
        strikeDutyOrder: isAdmin ? dto.strikeDutyOrder : undefined,
      },
    });
    if (isAdmin && dto.remoteDaysAssigned) {
      await this.prisma.remoteDay.deleteMany({ where: { employeeId: id } });
      await this.prisma.remoteDay.createMany({ data: dto.remoteDaysAssigned.map((day) => ({ employeeId: id, day })), skipDuplicates: true });
    }
    const password = dto.password?.trim();
    if (current.user) {
      await this.prisma.user.update({
        where: { id: current.user.id },
        data: {
          email: dto.email,
          cuil: isAdmin && dto.cuil ? this.cleanCuil(dto.cuil) : undefined,
          role: isAdmin && dto.isAdmin !== undefined ? toRole(dto.isAdmin) : undefined,
          mustChangePassword: isAdmin ? dto.mustChangePassword : undefined,
          passwordHash: isAdmin && password ? await bcrypt.hash(password, 10) : undefined,
        },
      });
    }
    await this.audit.record(user, { action: 'UPDATE_EMPLOYEE', module: 'EMPLOYEES', entityType: 'Employee', entityId: id, title: dto.name || current.name, detail: user?.employeeId === id ? 'Perfil propio actualizado' : 'Empleado editado' });
    if (isAdmin && password) {
      await this.audit.record(user, { action: 'RESET_EMPLOYEE_PASSWORD', module: 'EMPLOYEES', entityType: 'Employee', entityId: id, title: dto.name || current.name, detail: 'Contrase�a de agente actualizada por ADMIN' });
    }
    return this.findOne(id, { id: '', cuil: '', email: '', role: Role.ADMIN });
  }

  async remove(id: string, user: JwtUser) {
    const current = await this.prisma.employee.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Empleado no encontrado');
    await this.prisma.employee.update({ where: { id }, data: { deletedAt: new Date(), user: { update: { deletedAt: new Date() } } } });
    await this.audit.record(user, { action: 'DELETE', module: 'EMPLOYEES', entityType: 'Employee', entityId: id, title: current.name, detail: 'Empleado desactivado' });
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

  async adjustCompensatoryDays(id: string, days: number, user: JwtUser) {
    const current = await this.prisma.employee.findFirst({ where: { id, deletedAt: null } });
    if (!current) throw new NotFoundException('Empleado no encontrado');
    await this.prisma.employee.update({ where: { id }, data: { compensatoryDays: days } });
    await this.audit.record(user, { action: 'RESET_COMPENSATORY_DAYS', module: 'EMPLOYEES', entityType: 'Employee', entityId: id, title: current.name, detail: `Ajustó días compensatorios de ${current.compensatoryDays} a ${days}` });
    return this.findOne(id, { id: '', cuil: '', email: '', role: Role.ADMIN });
  }
}
