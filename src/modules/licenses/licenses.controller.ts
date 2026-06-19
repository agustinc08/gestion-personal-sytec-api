import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateLicenseRequestDto } from './dto/create-license-request.dto';
import { RenderLicensePdfDto } from './dto/render-license-pdf.dto';
import { UpdateLicenseRequestDto } from './dto/update-license-request.dto';
import { LicenseArticlesService } from './license-articles.service';
import { LicensesService } from './licenses.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('licenses')
export class LicensesController {
  constructor(private licenses: LicensesService, private articles: LicenseArticlesService) {}
  @Get() @Roles(Role.ADMIN) findAll() { return this.licenses.findAll(); }
  @Get('my') my(@CurrentUser() user: JwtUser) { return this.licenses.findMine(user); }
  @Get('rules') rules() { return this.licenses.rules(); }
  @Post() create(@Body() dto: CreateLicenseRequestDto, @CurrentUser() user: JwtUser) { return this.licenses.create(dto, user); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateLicenseRequestDto, @CurrentUser() user: JwtUser) { return this.licenses.update(id, dto, user); }
  @Patch(':id/approve') @Roles(Role.ADMIN) approve(@Param('id') id: string) { return this.licenses.approve(id); }
  @Patch(':id/reject') @Roles(Role.ADMIN) reject(@Param('id') id: string) { return this.licenses.reject(id); }
  @Post(':id/generate-pdf') @Roles(Role.ADMIN) @Header('Content-Type', 'application/pdf')
  async generatePdf(@Param('id') id: string, @Body() dto: RenderLicensePdfDto, @Res() res: any) {
    const pdf = await this.articles.renderLicensePdf(id, dto);
    res.setHeader('Content-Disposition', 'inline; filename="licencia.pdf"');
    res.send(pdf);
  }
  @Delete() @Roles(Role.ADMIN) clear() { return this.licenses.clear(); }
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: JwtUser) { return this.licenses.remove(id, user); }
}
