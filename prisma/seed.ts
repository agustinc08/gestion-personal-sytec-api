import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const rules = [
  ['Guardia en Feria', 'Guardia en Feria (Suma Dias)', 'Acredita dias adicionales por guardia obligatoria durante feria judicial.', 90],
  ['Art. 14', 'Licencias Ordinarias (Ferias)', 'Ferias judiciales y compensatorios.', 30],
  ['Art. 20 (M)', 'Maternidad', 'Licencia extraordinaria por maternidad.', 90],
  ['Art. 20 (P)', 'Paternidad', 'Licencia extraordinaria por paternidad.', 15],
  ['Art. 22', 'Enfermedad (Corto tratamiento)', 'Inasistencia justificada por enfermedad de corto tratamiento.', 30],
  ['Art. 23', 'Enfermedad (Largo tratamiento)', 'Licencia por largo tratamiento.', 365],
  ['Art. 28', 'Enfermedad (Tratamiento especial)', 'Tratamiento especial.', 20],
  ['Art. 29', 'Atencion de familiar enfermo', 'Cuidado de familiar directo enfermo.', 20],
  ['Art. 30', 'Matrimonio', 'Licencia por casamiento.', 10],
  ['Art. 31', 'Actividades cientificas / culturales', 'Congresos o capacitaciones.', 15],
  ['Art. 32', 'Examenes', 'Rendir examenes.', 20],
  ['Art. 33', 'Motivos particulares (Sin goce)', 'Motivos personales sin goce.', 180],
  ['Art. 34.a', 'Inasistencia Nacimiento / Casamiento', 'Nacimiento de hijo o casamiento de familiar.', 2],
  ['Art. 34.b 1', 'Fallecimiento Familiar Directo', 'Fallecimiento de conyuge, hijos o padres.', 5],
  ['Art. 34.b 2', 'Fallecimiento Segundo Grado', 'Fallecimiento de otros parientes hasta segundo grado.', 2],
  ['Art. 34.C', 'Razones particulares (Asistencias)', 'Inasistencia con justificacion personal.', 6],
  ['Art. 34.d', 'Integracion de mesa examinadora', 'Participacion docente en mesas examinadoras.', 6],
  ['Art. 14 bis', 'Tareas gremiales', 'Representacion o tareas gremiales.', 10],
  ['Ley 24.571', 'Licencia Religiosa', 'Festividades religiosas.', 4],
] as const;

async function main() {
  const cuil = (process.env.ADMIN_CUIL || '20000000000').replace(/\D/g, '');
  const email = process.env.ADMIN_EMAIL?.trim() || null;
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const name = process.env.ADMIN_NAME || 'Administrador';

  const employee = await prisma.employee.upsert({
    where: { cuil },
    update: { name, email },
    create: {
      name,
      email,
      dependency: 'Oficina de Sistemas y Tecnologia (SyTec)',
      position: 'Administrador',
      cuil,
      totalLicenseDays: 0,
      strikeDutyOrder: -1,
    },
  });

  await prisma.user.upsert({
    where: { cuil },
    update: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: Role.ADMIN,
      mustChangePassword: false,
      employeeId: employee.id,
    },
    create: {
      cuil,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: Role.ADMIN,
      mustChangePassword: false,
      employeeId: employee.id,
    },
  });

  for (const [article, ruleName, description, maxDaysPerYear] of rules) {
    await prisma.licenseRule.upsert({
      where: { article },
      update: { name: ruleName, description, maxDaysPerYear },
      create: { article, name: ruleName, description, maxDaysPerYear },
    });
  }

  await prisma.strikeConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', notes: 'Configuracion inicial' },
  });
}

main().finally(async () => prisma.$disconnect());
