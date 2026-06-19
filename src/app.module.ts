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
  ],
  controllers: [HealthController],
})
export class AppModule {}
