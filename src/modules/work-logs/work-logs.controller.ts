import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateWorkLogDto } from './dto/create-work-log.dto';
import { UpdateWorkLogDto } from './dto/update-work-log.dto';
import { SaveDailyAttendanceDto } from './dto/save-daily-attendance.dto';
import { WorkLogsService } from './work-logs.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('work-logs')
export class WorkLogsController {
  constructor(private workLogs: WorkLogsService) {}
  @Get() @Roles(Role.ADMIN) findAll(@Query() query: Record<string, string>) { return this.workLogs.findAll(query); }
  @Get('my') mine(@CurrentUser() user: JwtUser, @Query() query: Record<string, string>) { return this.workLogs.findMine(user, query); }
  @Get('attendance') attendances(@CurrentUser() user: JwtUser, @Query() query: Record<string, string>) { return this.workLogs.findAttendances(query, user); }
  @Post('attendance') saveAttendance(@Body() dto: SaveDailyAttendanceDto, @CurrentUser() user: JwtUser) { return this.workLogs.saveAttendance(dto, user); }
  @Post() create(@Body() dto: CreateWorkLogDto, @CurrentUser() user: JwtUser) { return this.workLogs.create(dto, user); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateWorkLogDto, @CurrentUser() user: JwtUser) { return this.workLogs.update(id, dto, user); }
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: JwtUser) { return this.workLogs.remove(id, user); }
}
