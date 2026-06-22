import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

const defaults = [
  { key: 'officeName', value: 'Oficina de Sistemas y Tecnología', label: 'Nombre de la oficina', type: 'text' },
  { key: 'defaultPageSize', value: 10, label: 'Cantidad por página', type: 'number' },
  { key: 'strikeReminderDays', value: [7, 3, 1, 0], label: 'Días de recordatorio de guardias', type: 'json' },
  { key: 'projectAlertDays', value: 15, label: 'Días de alerta de proyectos', type: 'number' },
  { key: 'dailyWorklogReminderEnabled', value: true, label: 'Recordatorio de parte diario', type: 'boolean' },
  { key: 'licenseNotificationsEnabled', value: true, label: 'Notificaciones de licencias', type: 'boolean' },
  { key: 'projectNotificationsEnabled', value: true, label: 'Notificaciones de proyectos', type: 'boolean' },
];

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
  async findAll() {
    await Promise.all(defaults.map((setting) => this.prisma.systemSetting.upsert({ where: { key: setting.key }, update: {}, create: { ...setting, value: setting.value as Prisma.InputJsonValue } })));
    return this.prisma.systemSetting.findMany({ orderBy: { label: 'asc' } });
  }
  async update(key: string, value: unknown, user: JwtUser) {
    const allowed = defaults.find((setting) => setting.key === key);
    if (!allowed) throw new NotFoundException('Configuración no encontrada');
    if (value === undefined) throw new BadRequestException('Valor requerido');
    const row = await this.prisma.systemSetting.upsert({ where: { key }, update: { value: value as Prisma.InputJsonValue }, create: { ...allowed, value: value as Prisma.InputJsonValue } });
    await this.audit.record(user, { action: 'UPDATE', module: 'SETTINGS', entityType: 'SystemSetting', entityId: row.id, title: allowed.label, detail: 'Configuración actualizada' });
    return row;
  }
}
