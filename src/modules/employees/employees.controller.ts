import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private employees: EmployeesService) {}

  @Get() @Roles(Role.ADMIN) findAll() { return this.employees.findAll(); }
  @Get('me') me(@CurrentUser() user: JwtUser) { return this.employees.findMe(user); }
  @Patch('me') updateMe(@CurrentUser() user: JwtUser, @Body() dto: UpdateEmployeeDto) { return this.employees.update(user.employeeId!, dto, user); }
  @Get(':id') findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) { return this.employees.findOne(id, user); }
  @Post() @Roles(Role.ADMIN) create(@Body() dto: CreateEmployeeDto) { return this.employees.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto, @CurrentUser() user: JwtUser) { return this.employees.update(id, dto, user); }
  @Delete(':id') @Roles(Role.ADMIN) remove(@Param('id') id: string) { return this.employees.remove(id); }
}
