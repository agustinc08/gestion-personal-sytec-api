import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateProjectUpdateDto } from './dto/create-project-update.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private projects: ProjectsService) {}
  @Get() findAll() { return this.projects.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.projects.findOne(id); }
  @Post() @Roles(Role.ADMIN) create(@Body() dto: CreateProjectDto) { return this.projects.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateProjectDto) { return this.projects.update(id, dto); }
  @Delete(':id') @Roles(Role.ADMIN) remove(@Param('id') id: string) { return this.projects.remove(id); }
  @Get(':id/updates') updates(@Param('id') id: string) { return this.projects.updates(id); }
  @Post(':id/updates') addUpdate(@Param('id') id: string, @Body() dto: CreateProjectUpdateDto, @CurrentUser() user: JwtUser) { return this.projects.addUpdate(id, dto, user); }
}
