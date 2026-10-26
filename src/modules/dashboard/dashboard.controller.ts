import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboard: DashboardService) {}
  @Get('admin') @Roles(Role.ADMIN) admin() { return this.dashboard.admin(); }
  @Get('admin-summary') @Roles(Role.ADMIN) adminSummary() { return this.dashboard.adminSummary(); }
  @Get('admin-worklog-calendar') @Roles(Role.ADMIN) adminWorklogCalendar(@Query() query: Record<string, string>) { return this.dashboard.adminWorklogCalendar(query); }
  @Get('employee') employee(@CurrentUser() user: JwtUser) { return this.dashboard.employee(user.employeeId); }
}
