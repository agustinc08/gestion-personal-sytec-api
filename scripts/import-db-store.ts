import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const inputArg = args.find((arg) => arg !== '--dry-run');
const inputPath = inputArg || process.env.DB_STORE_PATH || path.resolve(process.cwd(), '..', 'db-store.json');

const summary = {
  employees: 0,
  users: 0,
  projects: 0,
  updates: 0,
  workLogs: 0,
  licenses: 0,
  remoteDays: 0,
  skipped: 0,
  errors: 0,
};

const idMap = new Map<string, string>();

const cleanCuil = (value?: unknown) => String(value || '').replace(/\D/g, '');
const cleanEmail = (value?: unknown) => {
  const email = String(value || '').trim().toLowerCase();
  return email.includes('@') ? email : null;
};
const asDate = (value?: string) => (value ? new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`) : new Date());
const licenseStatus = (status?: string) => ({ aprobado: 'APPROVED', rechazado: 'REJECTED', cancelado: 'CANCELLED' }[status || ''] || 'PENDING') as any;
const projectStatus = (status?: string) => ({ completado: 'COMPLETED', pausado: 'PAUSED' }[status || ''] || 'ACTIVE') as any;
const workMode = (mode?: string) => ({ remoto: 'REMOTE', licencia: 'LICENSE' }[mode || ''] || 'ONSITE') as any;
const isBcryptHash = (value: string) => /^\$2[aby]\$\d{2}\$/.test(value);
const fallbackCuil = (raw: any, index: number) => `legacy-${cleanCuil(raw?.id) || index + 1}`;

function validateRoot(data: any) {
  if (!data || typeof data !== 'object') throw new Error('Estructura invalida: el JSON raiz debe ser un objeto');
  for (const key of ['employees', 'projects', 'workLogs', 'licenseRequests']) {
    if (data[key] !== undefined && !Array.isArray(data[key])) throw new Error(`Estructura invalida: ${key} debe ser array`);
  }
}

async function passwordHashFor(raw: any, cuil: string) {
  const candidate = String(raw.password || raw.contrasena || raw.passwordHash || '').trim();
  if (candidate && isBcryptHash(candidate)) return candidate;
  const plainPassword = candidate.length >= 4 ? candidate : cuil;
  return bcrypt.hash(plainPassword, 10);
}

async function upsertEmployee(raw: any, index: number) {
  const legacyId = raw.id ? String(raw.id) : null;
  const cuil = cleanCuil(raw.cuil || raw.cuit || raw.username) || fallbackCuil(raw, index);
  const email = cleanEmail(raw.email);
  const name = String(raw.name || raw.nombre || `Empleado ${cuil}`).trim();
  const dependency = String(raw.dependency || raw.dependencia || 'Sin dependencia').trim();

  if (dryRun) {
    if (legacyId) idMap.set(legacyId, `dry-${legacyId}`);
    summary.employees++;
    summary.users++;
    summary.remoteDays += Array.isArray(raw.remoteDaysAssigned) ? raw.remoteDaysAssigned.length : 0;
    return;
  }

  const or = [
    ...(legacyId ? [{ legacyId }] : []),
    { cuil },
    ...(email ? [{ email }] : []),
  ];
  const existing = await prisma.employee.findFirst({ where: { OR: or }, include: { user: true } });
  const employeeData = {
    legacyId,
    name,
    email,
    avatar: raw.avatar || null,
    dependency,
    position: raw.position || raw.cargo || null,
    cuil,
    totalLicenseDays: Number(raw.totalLicenseDays || 0),
    strikeDutyOrder: raw.strikeDutyOrder ?? -1,
  };
  const employee = existing
    ? await prisma.employee.update({ where: { id: existing.id }, data: employeeData })
    : await prisma.employee.create({ data: employeeData });
  if (legacyId) idMap.set(legacyId, employee.id);
  summary.employees += existing ? 0 : 1;

  await prisma.remoteDay.deleteMany({ where: { employeeId: employee.id } });
  for (const day of raw.remoteDaysAssigned || []) {
    await prisma.remoteDay.create({ data: { employeeId: employee.id, day: String(day), legacyId: legacyId ? `${legacyId}:${day}` : undefined } }).catch(() => summary.skipped++);
    summary.remoteDays++;
  }

  const user = existing?.user || await prisma.user.findFirst({ where: { OR: [{ cuil }, ...(email ? [{ email }] : []), ...(legacyId ? [{ legacyId }] : [])] } });
  const userData = {
    legacyId,
    cuil,
    email,
    role: raw.isAdmin ? Role.ADMIN : Role.EMPLOYEE,
    employeeId: employee.id,
    passwordHash: await passwordHashFor(raw, cuil),
    mustChangePassword: raw.mustChangePassword ?? !(raw.password || raw.contrasena || raw.passwordHash),
  };
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: userData });
  } else {
    await prisma.user.create({ data: userData });
  }
  summary.users += user ? 0 : 1;
}

async function main() {
  if (!fs.existsSync(inputPath)) throw new Error(`No existe db-store.json en ${inputPath}`);
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  validateRoot(data);

  for (const [index, employee] of (data.employees || []).entries()) {
    await upsertEmployee(employee, index).catch((error) => {
      summary.errors++;
      console.error('employee', employee?.id, error.message);
    });
  }

  for (const project of data.projects || []) {
    if (dryRun) {
      summary.projects++;
      summary.updates += Array.isArray(project.updates) ? project.updates.length : 0;
      continue;
    }
    const assigned = (project.assignedEmployeeIds || []).map((oldId: string) => ({ id: idMap.get(oldId) })).filter((x: any) => x.id);
    const created = await prisma.project.upsert({
      where: { legacyId: String(project.id) },
      update: {
        name: project.name,
        description: project.description,
        requesterDependency: project.requesterDependency,
        status: projectStatus(project.status),
        assignedEmployees: { set: assigned },
      },
      create: {
        legacyId: String(project.id),
        name: project.name,
        description: project.description,
        requesterDependency: project.requesterDependency,
        status: projectStatus(project.status),
        assignedEmployees: { connect: assigned },
      },
    });
    summary.projects++;
    for (const update of project.updates || []) {
      await prisma.projectUpdate.upsert({
        where: { legacyId: String(update.id) },
        update: { content: update.content, authorName: update.authorName || 'Sistema' },
        create: { legacyId: String(update.id), projectId: created.id, content: update.content, authorName: update.authorName || 'Sistema', createdAt: new Date(update.date || Date.now()) },
      });
      summary.updates++;
    }
  }

  for (const log of data.workLogs || []) {
    if (dryRun) {
      summary.workLogs++;
      continue;
    }
    const employeeId = idMap.get(log.employeeId);
    if (!employeeId) {
      summary.skipped++;
      continue;
    }
    await prisma.workLog.upsert({
      where: { legacyId: String(log.id) },
      update: { title: log.title, description: log.description, date: asDate(log.date), mode: workMode(log.mode) },
      create: { legacyId: String(log.id), employeeId, title: log.title, description: log.description, date: asDate(log.date), mode: workMode(log.mode) },
    });
    summary.workLogs++;
  }

  for (const lic of data.licenseRequests || []) {
    if (dryRun) {
      summary.licenses++;
      continue;
    }
    const employeeId = idMap.get(lic.employeeId);
    if (!employeeId) {
      summary.skipped++;
      continue;
    }
    await prisma.licenseRequest.upsert({
      where: { legacyId: String(lic.id) },
      update: { article: lic.article, startDate: asDate(lic.startDate), endDate: asDate(lic.endDate), reason: lic.reason, certificateName: lic.certificateName, status: licenseStatus(lic.status), dateRequested: asDate(lic.dateRequested) },
      create: { legacyId: String(lic.id), employeeId, article: lic.article, startDate: asDate(lic.startDate), endDate: asDate(lic.endDate), reason: lic.reason, certificateName: lic.certificateName, status: licenseStatus(lic.status), dateRequested: asDate(lic.dateRequested) },
    });
    summary.licenses++;
  }

  if (data.strikeConfig && !dryRun) {
    await prisma.strikeConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', nextDate: data.strikeConfig.nextDate ? asDate(data.strikeConfig.nextDate) : null, nextCoverEmployeeId: idMap.get(data.strikeConfig.nextCoverEmployeeId), lastDate: data.strikeConfig.lastDate ? asDate(data.strikeConfig.lastDate) : null, lastCoverEmployeeId: idMap.get(data.strikeConfig.lastCoverEmployeeId), notes: data.strikeConfig.notes },
      update: { nextDate: data.strikeConfig.nextDate ? asDate(data.strikeConfig.nextDate) : null, nextCoverEmployeeId: idMap.get(data.strikeConfig.nextCoverEmployeeId), lastDate: data.strikeConfig.lastDate ? asDate(data.strikeConfig.lastDate) : null, lastCoverEmployeeId: idMap.get(data.strikeConfig.lastCoverEmployeeId), notes: data.strikeConfig.notes },
    });
  }

  console.log(dryRun ? 'DRY RUN: no se escribio en PostgreSQL.' : 'Import finalizado.');
  console.table({
    'Empleados importados': summary.employees,
    'Usuarios importados': summary.users,
    'Proyectos importados': summary.projects,
    'Actualizaciones importadas': summary.updates,
    'Licencias importadas': summary.licenses,
    'Partes importados': summary.workLogs,
    'Dias remotos importados': summary.remoteDays,
    Omitidos: summary.skipped,
    Errores: summary.errors,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
