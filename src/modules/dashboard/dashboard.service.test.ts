import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ProjectStatus } from '@prisma/client';
import { DashboardService } from './dashboard.service';

describe('employee dashboard historical project references', () => {
  it('loads without active projects and keeps work logs readable when their project is missing or archived', async () => {
    let projectQuery: any;
    const prisma = {
      licenseRequest: {
        count: async () => 0,
        findFirst: async () => null,
      },
      workLog: {
        count: async () => 2,
        findFirst: async () => null,
        findMany: async () => [
          { id: 'log-missing', employeeId: 'employee-1', projectId: 'deleted-project', project: null, secondaryWorkItem: null, title: 'Migración de datos', description: '', date: new Date('2026-11-18T12:00:00Z'), mode: 'ONSITE', activityType: 'PROJECT', hours: 2 },
          { id: 'log-archived', employeeId: 'employee-1', projectId: 'archived-project', project: { id: 'archived-project', name: 'Sistema anterior' }, secondaryWorkItem: null, title: 'Mantenimiento', description: '', date: new Date('2026-11-17T12:00:00Z'), mode: 'REMOTE', activityType: 'PROJECT', hours: 1 },
        ],
      },
      project: {
        findMany: async (query: any) => { projectQuery = query; return []; },
      },
    };

    const dashboard = await new DashboardService(prisma as any).employee('employee-1');

    assert.deepEqual(projectQuery.where, {
      deletedAt: null,
      status: { not: ProjectStatus.ARCHIVED },
      assignedEmployees: { some: { id: 'employee-1' } },
    });
    assert.deepEqual(dashboard.projects, []);
    assert.deepEqual(dashboard.recentWorkLogs.map((row: any) => ({ projectName: row.projectName, displayTitle: row.displayTitle })), [
      { projectName: 'Proyecto no disponible', displayTitle: 'Migración de datos' },
      { projectName: 'Sistema anterior', displayTitle: 'Sistema anterior' },
    ]);
  });
});
