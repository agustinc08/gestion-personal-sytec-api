import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateRemoteDayDto } from './dto/create-remote-day.dto';
import { UpdateStrikeConfigDto } from './dto/update-strike-config.dto';
import { StrikeService } from './strike.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('strike')
export class StrikeController {
  constructor(private strike: StrikeService) {}
  @Get('config') config() { return this.strike.config(); }
  @Patch('config') @Roles(Role.ADMIN) updateConfig(@Body() dto: UpdateStrikeConfigDto) { return this.strike.updateConfig(dto); }
  @Get('remote-days') remoteDays() { return this.strike.remoteDays(); }
  @Post('remote-days') @Roles(Role.ADMIN) createRemoteDay(@Body() dto: CreateRemoteDayDto) { return this.strike.createRemoteDay(dto); }
  @Delete('remote-days/:id') @Roles(Role.ADMIN) deleteRemoteDay(@Param('id') id: string) { return this.strike.deleteRemoteDay(id); }
}
