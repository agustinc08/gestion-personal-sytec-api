import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateProjectCommentDto } from './dto/create-project-comment.dto';
import { CreateProjectUpdateDto } from './dto/create-project-update.dto';
import { CreateDeploymentDto } from './dto/create-deployment.dto';
import { UpdateDeploymentDto } from './dto/update-deployment.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private projects: ProjectsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtUser, @Query() query: Record<string, string>) {
    return this.projects.findAll(user, query);
  }

  @Get('deadlines')
  deadlines(@CurrentUser() user: JwtUser) {
    return this.projects.deadlines(user);
  }

  @Get('my')
  my(@CurrentUser() user: JwtUser) {
    return this.projects.my(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.projects.findOne(id, user);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: JwtUser) {
    return this.projects.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto, @CurrentUser() user: JwtUser) {
    return this.projects.update(id, dto, user);
  }

  @Delete(':id') @Roles(Role.ADMIN) remove(@Param('id') id: string, @CurrentUser() user: JwtUser) { return this.projects.remove(id, user); }

  @Get(':id/updates')
  updates(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.projects.updates(id, user);
  }

  @Get(':id/logs')
  logs(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.projects.updates(id, user);
  }

  @Post(':id/updates')
  addUpdate(@Param('id') id: string, @Body() dto: CreateProjectUpdateDto, @CurrentUser() user: JwtUser) {
    return this.projects.addUpdate(id, dto, user);
  }

  @Post(':id/logs')
  addLog(@Param('id') id: string, @Body() dto: CreateProjectUpdateDto, @CurrentUser() user: JwtUser) {
    return this.projects.addUpdate(id, dto, user);
  }

  @Get(':id/comments')
  comments(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.projects.comments(id, user);
  }

  @Post(':id/comments')
  addComment(@Param('id') id: string, @Body() dto: CreateProjectCommentDto, @CurrentUser() user: JwtUser) {
    return this.projects.addComment(id, dto.message, user);
  }

  @Delete(':id/comments/:commentId')
  deleteComment(@Param('id') id: string, @Param('commentId') commentId: string, @CurrentUser() user: JwtUser) {
    return this.projects.deleteComment(id, commentId, user);
  }

  @Get(':id/deployments')
  deployments(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.projects.deployments(id, user);
  }

  @Post(':id/deployments')
  @Roles(Role.ADMIN)
  addDeployment(@Param('id') id: string, @Body() dto: CreateDeploymentDto, @CurrentUser() user: JwtUser) {
    return this.projects.addDeployment(id, dto, user);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('deployments')
export class DeploymentsController {
  constructor(private projects: ProjectsService) {}

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateDeploymentDto, @CurrentUser() user: JwtUser) {
    return this.projects.updateDeployment(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.projects.removeDeployment(id, user);
  }
}
