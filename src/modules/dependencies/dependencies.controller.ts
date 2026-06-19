import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DependenciesService } from './dependencies.service';
import { CreateDependencyDto } from './dto/create-dependency.dto';
import { UpdateDependencyDto } from './dto/update-dependency.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('dependencies')
export class DependenciesController {
  constructor(private readonly dependencies: DependenciesService) {}
  @Get() findAll() { return this.dependencies.findAll(); }
  @Post() create(@Body() dto: CreateDependencyDto) { return this.dependencies.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateDependencyDto) { return this.dependencies.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.dependencies.remove(id); }
}
