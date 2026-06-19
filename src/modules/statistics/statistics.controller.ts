import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StatisticsService } from './statistics.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('statistics')
export class StatisticsController {
  constructor(private statistics: StatisticsService) {}

  @Get('admin')
  @Roles(Role.ADMIN)
  admin(@Query() query: Record<string, string>) {
    return this.statistics.admin(query);
  }

  @Get('me')
  me(@CurrentUser() user: JwtUser, @Query() query: Record<string, string>) {
    return this.statistics.me(user, query);
  }
}
