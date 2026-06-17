import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async login(dto: LoginDto) {
    const cleanCuil = dto.cuil.replace(/\D/g, '');
    const user = await this.prisma.user.findFirst({
      where: {
        cuil: cleanCuil,
        deletedAt: null,
        employee: { deletedAt: null },
      },
      include: { employee: true },
    });
    if (!user) throw new UnauthorizedException('Credenciales invalidas');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales invalidas');
    return this.session(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true },
    });
    if (!user) throw new UnauthorizedException();
    return this.session(user, false);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('La contrasena actual es incorrecta');
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, 10), mustChangePassword: false },
    });
    return { status: 'success' };
  }

  async setPassword(userId: string, password: string, mustChangePassword = false) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword },
    });
  }

  private session(user: any, includeToken = true) {
    const publicUser = {
      id: user.id,
      cuil: user.cuil,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      mustChangePassword: user.mustChangePassword,
    };
    return {
      ...(includeToken ? { accessToken: this.jwt.sign({ sub: user.id }) } : {}),
      user: publicUser,
    };
  }
}
