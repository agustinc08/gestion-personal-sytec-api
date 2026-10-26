import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DependenciesService } from './dependencies.service';
import { CreateDependencyDto } from './dto/create-dependency.dto';
import { UpdateDependencyDto } from './dto/update-dependency.dto';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('dependencies')
export class DependenciesController {
  constructor(private readonly dependencies: DependenciesService) {}
  @Get() findAll() { return this.dependencies.findAll(); }
  @Post() create(@Body() dto: CreateDependencyDto, @CurrentUser() user: JwtUser) { return this.dependencies.create(dto, user); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateDependencyDto, @CurrentUser() user: JwtUser) { return this.dependencies.update(id, dto, user); }
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: JwtUser) { return this.dependencies.remove(id, user); }
}
