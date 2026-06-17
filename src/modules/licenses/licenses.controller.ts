import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateLicenseRequestDto } from './dto/create-license-request.dto';
import { UpdateLicenseRequestDto } from './dto/update-license-request.dto';
import { LicensesService } from './licenses.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('licenses')
export class LicensesController {
  constructor(private licenses: LicensesService) {}
  @Get() @Roles(Role.ADMIN) findAll() { return this.licenses.findAll(); }
  @Get('my') my(@CurrentUser() user: JwtUser) { return this.licenses.findMine(user); }
  @Get('rules') rules() { return this.licenses.rules(); }
  @Post() create(@Body() dto: CreateLicenseRequestDto, @CurrentUser() user: JwtUser) { return this.licenses.create(dto, user); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateLicenseRequestDto, @CurrentUser() user: JwtUser) { return this.licenses.update(id, dto, user); }
  @Patch(':id/approve') @Roles(Role.ADMIN) approve(@Param('id') id: string) { return this.licenses.approve(id); }
  @Patch(':id/reject') @Roles(Role.ADMIN) reject(@Param('id') id: string) { return this.licenses.reject(id); }
}
