import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { LicensesModule } from './modules/licenses/licenses.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { StrikeModule } from './modules/strike/strike.module';
import { UsersModule } from './modules/users/users.module';
import { WorkLogsModule } from './modules/work-logs/work-logs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DependenciesModule } from './modules/dependencies/dependencies.module';
import { AuditModule } from './modules/audit/audit.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SearchModule } from './modules/search/search.module';
import { ExportsModule } from './modules/exports/exports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    EmployeesModule,
    ProjectsModule,
    WorkLogsModule,
    LicensesModule,
    StrikeModule,
    DashboardModule,
    StatisticsModule,
    NotificationsModule,
    DependenciesModule,
    AuditModule,
    SettingsModule,
    SearchModule,
    ExportsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
