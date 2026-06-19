import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LicenseStatus, Prisma, Role } from '@prisma/client';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

type Notice = { type: string; title: string; message: string; link?: string; key: string; metadata?: Prisma.InputJsonValue };

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private day(value = new Date()) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  private dateKey(value: Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }

  private audience(user: JwtUser) {
    return { OR: [{ userId: user.id }, ...(user.employeeId ? [{ employeeId: user.employeeId }] : []), { roleTarget: user.role }] };
  }

  private async create(user: JwtUser, notice: Notice) {
    await this.prisma.notification.upsert({
      where: { dedupeKey: `${user.id}:${notice.key}` },
      update: { title: notice.title, message: notice.message, link: notice.link, metadata: notice.metadata },
      create: { userId: user.id, type: notice.type, title: notice.title, message: notice.message, link: notice.link, metadata: notice.metadata, dedupeKey: `${user.id}:${notice.key}` },
    });
  }

  private async refresh(user: JwtUser) {
    const today = this.day();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const todayKey = this.dateKey(today);
    const notices: Notice[] = [];

    if (user.role === Role.EMPLOYEE && user.employeeId) {
      const workLog = await this.prisma.workLog.findFirst({ where: { employeeId: user.employeeId, deletedAt: null, date: { gte: today, lt: tomorrow } }, select: { id: true } });
      if (!workLog) notices.push({ type: 'DAILY_WORKLOG_PENDING', title: 'Parte diario pendiente', message: 'Todavía no cargaste tu parte diario de hoy.', link: '/?seccion=parte-diario', key: `worklog:${todayKey}` });

      const recentLicenses = await this.prisma.licenseRequest.findMany({ where: { employeeId: user.employeeId, deletedAt: null, status: { in: [LicenseStatus.APPROVED, LicenseStatus.REJECTED] }, updatedAt: { gte: new Date(today.getTime() - 30 * 86400000) } }, select: { id: true, status: true, updatedAt: true } });
      recentLicenses.forEach((license) => notices.push({ type: 'LICENSE_STATUS_EMPLOYEE', title: license.status === LicenseStatus.APPROVED ? 'Licencia aprobada' : 'Licencia rechazada', message: `Tu solicitud de licencia fue ${license.status === LicenseStatus.APPROVED ? 'aprobada' : 'rechazada'}.`, link: '/?seccion=licencias', key: `license:${license.id}:${license.status}` }));
    }

    if (user.role === Role.ADMIN) {
      const [pendingLicenses, employeesWithLog, activeEmployees] = await Promise.all([
        this.prisma.licenseRequest.count({ where: { status: LicenseStatus.PENDING, deletedAt: null } }),
        this.prisma.workLog.findMany({ where: { deletedAt: null, date: { gte: today, lt: tomorrow } }, distinct: ['employeeId'], select: { employeeId: true } }),
        this.prisma.employee.count({ where: { deletedAt: null } }),
      ]);
      if (pendingLicenses) notices.push({ type: 'LICENSE_PENDING_ADMIN', title: 'Licencias pendientes', message: `Hay ${pendingLicenses} ${pendingLicenses === 1 ? 'solicitud de licencia esperando' : 'solicitudes de licencia esperando'} revisión.`, link: '/?seccion=licencias', key: `licenses-pending:${todayKey}`, metadata: { count: pendingLicenses } });
      const missing = Math.max(0, activeEmployees - employeesWithLog.length);
      if (missing) notices.push({ type: 'DAILY_WORKLOG_PENDING', title: 'Partes diarios pendientes', message: `Hay ${missing} ${missing === 1 ? 'agente' : 'agentes'} sin cargar el parte diario de hoy.`, link: '/?seccion=asistencia', key: `admin-worklog:${todayKey}`, metadata: { count: missing } });
    }

    const strike = await this.prisma.strikeConfig.findUnique({ where: { id: 'default' } });
    if (strike?.nextDate && strike.nextCoverEmployeeId) {
      const dutyDate = this.day(strike.nextDate);
      const days = Math.round((dutyDate.getTime() - today.getTime()) / 86400000);
      if ([7, 3, 1, 0].includes(days) && (user.role === Role.ADMIN || user.employeeId === strike.nextCoverEmployeeId)) {
        const employee = await this.prisma.employee.findUnique({ where: { id: strike.nextCoverEmployeeId }, select: { name: true } });
        const formatted = dutyDate.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
        const employeeMessage = days === 0 ? `Hoy te toca cubrir la guardia (${formatted}).` : days === 1 ? `Mañana te toca cubrir la guardia (${formatted}).` : `Te toca cubrir la guardia el ${formatted}.`;
        notices.push({ type: 'STRIKE_DUTY_REMINDER', title: user.role === Role.ADMIN ? 'Próxima guardia de paro' : 'Guardia de paro asignada', message: user.role === Role.ADMIN ? `${employee?.name || 'Un agente'} cubre el ${formatted}.` : employeeMessage, link: '/?seccion=guardias', key: `strike:${strike.nextCoverEmployeeId}:${this.dateKey(dutyDate)}:${days}` });
      }
    }

    const deadlineLimit = new Date(today); deadlineLimit.setDate(today.getDate() + 15);
    const projects = await this.prisma.project.findMany({ where: { deletedAt: null, deadline: { not: null, lte: deadlineLimit }, ...(user.role === Role.EMPLOYEE ? { assignedEmployees: { some: { id: user.employeeId || '' } } } : {}) }, select: { id: true, name: true, deadline: true } });
    projects.forEach((project) => {
      const deadline = this.day(project.deadline!);
      const days = Math.round((deadline.getTime() - today.getTime()) / 86400000);
      const status = days < 0 ? 'está vencido' : days === 0 ? 'vence hoy' : `vence en ${days} ${days === 1 ? 'día' : 'días'}`;
      notices.push({ type: 'PROJECT_DEADLINE', title: days < 0 ? 'Proyecto vencido' : 'Proyecto próximo a vencer', message: `El proyecto ${project.name} ${status}.`, link: `/?seccion=proyectos&proyecto=${project.id}`, key: `deadline:${project.id}:${todayKey}`, metadata: { projectId: project.id, days } });
    });

    await Promise.all(notices.map((notice) => this.create(user, notice)));
  }

  async findAll(user: JwtUser) {
    await this.refresh(user);
    const where: any = { ...this.audience(user), OR: this.audience(user).OR, AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }] };
    const items = await this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
    return { items, unreadCount: items.filter((item) => !item.readAt).length };
  }

  async read(id: string, user: JwtUser) {
    const row = await this.prisma.notification.findFirst({ where: { id, ...this.audience(user) } });
    if (!row) throw new NotFoundException('Notificación no encontrada');
    if (row.userId && row.userId !== user.id) throw new ForbiddenException();
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async readAll(user: JwtUser) {
    await this.prisma.notification.updateMany({ where: { ...this.audience(user), readAt: null }, data: { readAt: new Date() } });
    return { status: 'ok' };
  }
}
