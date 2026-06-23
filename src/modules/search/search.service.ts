import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}
  async search(q: string, user: JwtUser) {
    const text = q.trim();
    if (text.length < 2) return { employees: [], projects: [], licenses: [], dependencies: [], workLogs: [], comments: [] };
    const own = user.role !== Role.ADMIN;
    const [employees, projects, licenses, dependencies, workLogs, comments] = await Promise.all([
      this.prisma.employee.findMany({ where: { deletedAt: null, ...(own ? { id: user.employeeId || '' } : {}), OR: [{ name: { contains: text, mode: 'insensitive' } }, { email: { contains: text, mode: 'insensitive' } }, { dependency: { contains: text, mode: 'insensitive' } }] }, select: { id: true, name: true, dependency: true }, take: 8 }),
      this.prisma.project.findMany({ where: { deletedAt: null, ...(own ? { assignedEmployees: { some: { id: user.employeeId || '' } } } : {}), OR: [{ name: { contains: text, mode: 'insensitive' } }, { description: { contains: text, mode: 'insensitive' } }] }, select: { id: true, name: true, requesterDependency: true, updatedAt: true }, take: 8 }),
      this.prisma.licenseRequest.findMany({ where: { deletedAt: null, ...(own ? { employeeId: user.employeeId || '' } : {}), OR: [{ article: { contains: text, mode: 'insensitive' } }, { reason: { contains: text, mode: 'insensitive' } }] }, include: { employee: { select: { name: true } } }, take: 8, orderBy: { dateRequested: 'desc' } }),
      this.prisma.dependency.findMany({ where: { deletedAt: null, ...(own ? { employees: { some: { id: user.employeeId || '' } } } : {}), OR: [{ name: { contains: text, mode: 'insensitive' } }, { description: { contains: text, mode: 'insensitive' } }] }, select: { id: true, name: true, description: true }, take: 8 }),
      this.prisma.workLog.findMany({ where: { deletedAt: null, ...(own ? { employeeId: user.employeeId || '' } : {}), OR: [{ title: { contains: text, mode: 'insensitive' } }, { description: { contains: text, mode: 'insensitive' } }] }, include: { employee: { select: { name: true } } }, take: 8, orderBy: { date: 'desc' } }),
      this.prisma.projectComment.findMany({ where: { deletedAt: null, message: { contains: text, mode: 'insensitive' }, ...(own ? { project: { assignedEmployees: { some: { id: user.employeeId || '' } } } } : {}) }, include: { project: { select: { id: true, name: true } } }, take: 8, orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      employees: employees.map((row) => {
        const section = own ? 'perfil' : 'empleados';
        return { type: 'Empleado', title: row.name, subtitle: row.dependency, section, entityId: row.id, link: `?seccion=${section}` };
      }),
      projects: projects.map((row) => ({ type: 'Proyecto', title: row.name, subtitle: row.requesterDependency, section: 'proyectos', entityId: row.id, link: `?seccion=proyectos&proyecto=${row.id}`, date: row.updatedAt })),
      licenses: licenses.map((row) => ({ type: 'Licencia', title: row.article, subtitle: `${row.employee.name}: ${row.reason}`, section: 'licencias', entityId: row.id, link: '?seccion=licencias', date: row.dateRequested })),
      dependencies: dependencies.map((row) => ({ type: 'Dependencia', title: row.name, subtitle: row.description || '', section: own ? 'perfil' : 'dependencias', entityId: row.id, link: `?seccion=${own ? 'perfil' : 'dependencias'}` })),
      workLogs: workLogs.map((row) => ({ type: 'Parte diario', title: row.title, subtitle: row.employee.name, section: 'parte-diario', entityId: row.id, link: '?seccion=parte-diario', date: row.date })),
      comments: comments.map((row) => ({ type: 'Comentario', title: row.project.name, subtitle: row.message, section: 'proyectos', entityId: row.project.id, link: `?seccion=proyectos&proyecto=${row.project.id}`, date: row.createdAt })),
    };
  }
}
