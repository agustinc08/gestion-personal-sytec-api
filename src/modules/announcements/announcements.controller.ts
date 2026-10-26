import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private announcements: AnnouncementsService) {}
  @Get('active') active(@CurrentUser() user: JwtUser) { return this.announcements.findActive(user); }
  @Patch('read-all') readAll(@CurrentUser() user: JwtUser) { return this.announcements.readAll(user); }
  @Get() @Roles(Role.ADMIN) findAll() { return this.announcements.findAll(); }
  @Post() @Roles(Role.ADMIN) create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: JwtUser) { return this.announcements.create(dto, user); }
  @Patch(':id/read') read(@Param('id') id: string, @CurrentUser() user: JwtUser) { return this.announcements.read(id, user); }
  @Patch(':id') @Roles(Role.ADMIN) update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto, @CurrentUser() user: JwtUser) { return this.announcements.update(id, dto, user); }
  @Delete(':id') @Roles(Role.ADMIN) remove(@Param('id') id: string, @CurrentUser() user: JwtUser) { return this.announcements.remove(id, user); }
}
