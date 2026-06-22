import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}
  private async workbook(sheetName: string, rows: Record<string, unknown>[]) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gestión Personal SyTec';
    const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
    const keys = rows.length ? Object.keys(rows[0]) : ['Sin datos'];
    sheet.columns = keys.map((key) => ({ header: key, key, width: Math.max(14, Math.min(40, key.length + 6)) }));
    rows.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
  private dateRange(query: Record<string, string>, field: string) {
    return query.from || query.to ? { [field]: { ...(query.from ? { gte: new Date(`${query.from}T00:00:00`) } : {}), ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999`) } : {}) } } : {};
  }
  async employees(query: Record<string, string>) {
    const rows = await this.prisma.employee.findMany({ where: { deletedAt: null, ...(query.dependencyId ? { dependencyId: query.dependencyId } : {}) }, include: { dependencyRef: true }, orderBy: { name: 'asc' } });
    return this.workbook('Empleados', rows.map((row) => ({ Nombre: row.name, Email: row.email || '', Dependencia: row.dependencyRef?.name || row.dependency, Cargo: row.position || '', CUIL: row.cuil, 'Días licencia': row.totalLicenseDays })));
  }
  async licenses(query: Record<string, string>) {
    const rows = await this.prisma.licenseRequest.findMany({ where: { deletedAt: null, ...(query.employeeId ? { employeeId: query.employeeId } : {}), ...(query.status ? { status: query.status as any } : {}), ...this.dateRange(query, 'dateRequested') }, include: { employee: true }, orderBy: { dateRequested: 'desc' } });
    return this.workbook('Licencias', rows.map((row) => ({ Empleado: row.employee.name, Artículo: row.article, Desde: row.startDate, Hasta: row.endDate, Motivo: row.reason, Estado: row.status, Solicitada: row.dateRequested })));
  }
  async workLogs(query: Record<string, string>) {
    const rows = await this.prisma.workLog.findMany({ where: { deletedAt: null, ...(query.employeeId ? { employeeId: query.employeeId } : {}), ...(query.projectId ? { projectId: query.projectId } : {}), ...this.dateRange(query, 'date') }, include: { employee: true, project: true }, orderBy: { date: 'desc' } });
    return this.workbook('Parte diario', rows.map((row) => ({ Fecha: row.date, Empleado: row.employee.name, Título: row.title, Descripción: row.description, Proyecto: row.project?.name || '', Modalidad: row.mode, Actividad: row.activityType, Horas: row.hours ?? '' })));
  }
  async projects(query: Record<string, string>) {
    const rows = await this.prisma.project.findMany({ where: { deletedAt: null, ...(query.status ? { status: query.status as any } : {}), ...(query.employeeId ? { assignedEmployees: { some: { id: query.employeeId } } } : {}) }, include: { assignedEmployees: true }, orderBy: { updatedAt: 'desc' } });
    return this.workbook('Proyectos', rows.map((row) => ({ Proyecto: row.name, Estado: row.status, Solicitante: row.requesterDependency, Año: row.year, Dificultad: row.difficulty, Vencimiento: row.deadline || '', Responsable: row.assignedEmployees.map((employee) => employee.name).join(', '), Stack: row.techStack || '' })));
  }
  async dependencies() {
    const rows = await this.prisma.dependency.findMany({ where: { deletedAt: null }, include: { _count: { select: { employees: { where: { deletedAt: null } } } } }, orderBy: { name: 'asc' } });
    return this.workbook('Dependencias', rows.map((row) => ({ Nombre: row.name, Descripción: row.description || '', Estado: row.isActive ? 'Activa' : 'Inactiva', Empleados: row._count.employees })));
  }
  async technologyStats() {
    const rows = await this.prisma.project.findMany({ where: { deletedAt: null, techStack: { not: null } }, include: { assignedEmployees: true }, orderBy: { name: 'asc' } });
    return this.workbook('Tecnologías', rows.map((row) => ({ Proyecto: row.name, 'Stack declarado': row.techStack || '', Personas: row.assignedEmployees.map((employee) => employee.name).join(', ') })));
  }
  async strikeDuty() {
    const [config, employees] = await Promise.all([this.prisma.strikeConfig.findUnique({ where: { id: 'default' } }), this.prisma.employee.findMany({ where: { deletedAt: null, strikeDutyOrder: { gt: 0 } }, orderBy: { strikeDutyOrder: 'asc' } })]);
    return this.workbook('Guardias y paro', employees.map((row) => ({ Orden: row.strikeDutyOrder, Empleado: row.name, Dependencia: row.dependency, 'Próxima fecha': config?.nextCoverEmployeeId === row.id ? config.nextDate || '' : '', Observaciones: config?.nextCoverEmployeeId === row.id ? config.notes || '' : '' })));
  }
  async auditLogs(query: Record<string, string>) {
    const rows = await this.prisma.auditLog.findMany({ where: { ...(query.module ? { module: query.module } : {}), ...(query.action ? { action: query.action } : {}), ...this.dateRange(query, 'createdAt') }, include: { employee: true, user: true }, orderBy: { createdAt: 'desc' }, take: 10000 });
    return this.workbook('Auditoría', rows.map((row) => ({ Fecha: row.createdAt, Usuario: row.employee?.name || row.user?.cuil || '', Módulo: row.module, Acción: row.action, Título: row.title || '', Detalle: row.detail || '', Entidad: row.entityType || row.entity, 'ID entidad': row.entityId || '' })));
  }
}
