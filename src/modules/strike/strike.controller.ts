import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateRemoteDayDto } from './dto/create-remote-day.dto';
import { UpdateStrikeConfigDto } from './dto/update-strike-config.dto';
import { StrikeService } from './strike.service';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('strike')
export class StrikeController {
  constructor(private strike: StrikeService) {}
  @Get('config') config() { return this.strike.config(); }
  @Patch('config') @Roles(Role.ADMIN) updateConfig(@Body() dto: UpdateStrikeConfigDto, @CurrentUser() user: JwtUser) { return this.strike.updateConfig(dto, user); }
  /** @deprecated Legacy endpoint retained for external consumers; results remain role-scoped. */
  @Get('remote-days') remoteDays(@CurrentUser() user: JwtUser) { return this.strike.remoteDays(user); }
  @Post('remote-days') @Roles(Role.ADMIN) createRemoteDay(@Body() dto: CreateRemoteDayDto, @CurrentUser() user: JwtUser) { return this.strike.createRemoteDay(dto, user); }
  @Delete('remote-days/:id') @Roles(Role.ADMIN) deleteRemoteDay(@Param('id') id: string, @CurrentUser() user: JwtUser) { return this.strike.deleteRemoteDay(id, user); }
}
