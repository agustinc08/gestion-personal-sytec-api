import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}
  async admin() {
    const [employees, projects, pendingLicenses, workLogs] = await Promise.all([
      this.prisma.employee.count({ where: { deletedAt: null } }),
      this.prisma.project.count({ where: { deletedAt: null } }),
      this.prisma.licenseRequest.count({ where: { status: 'PENDING', deletedAt: null } }),
      this.prisma.workLog.count({ where: { deletedAt: null } }),
    ]);
    return { employees, projects, pendingLicenses, workLogs };
  }
  async employee(employeeId?: string | null) {
    if (!employeeId) return {};
    const [licenses, workLogs] = await Promise.all([
      this.prisma.licenseRequest.count({ where: { employeeId, deletedAt: null } }),
      this.prisma.workLog.count({ where: { employeeId, deletedAt: null } }),
    ]);
    return { licenses, workLogs };
  }
}
