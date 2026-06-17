import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateWorkLogDto } from './dto/create-work-log.dto';
import { UpdateWorkLogDto } from './dto/update-work-log.dto';
import { WorkLogsService } from './work-logs.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('work-logs')
export class WorkLogsController {
  constructor(private workLogs: WorkLogsService) {}
  @Get() @Roles(Role.ADMIN) findAll() { return this.workLogs.findAll(); }
  @Get('my') mine(@CurrentUser() user: JwtUser) { return this.workLogs.findMine(user); }
  @Post() create(@Body() dto: CreateWorkLogDto, @CurrentUser() user: JwtUser) { return this.workLogs.create(dto, user); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateWorkLogDto, @CurrentUser() user: JwtUser) { return this.workLogs.update(id, dto, user); }
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: JwtUser) { return this.workLogs.remove(id, user); }
}
