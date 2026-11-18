import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Query } from '@nestjs/common';
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
  @Get() @Roles(Role.ADMIN) findAll(@Query() query: Record<string, string>) { return this.licenses.findAll(query); }
  @Get('my') my(@CurrentUser() user: JwtUser, @Query() query: Record<string, string>) { return this.licenses.findMine(user, query); }
  @Get('rules') rules() { return this.licenses.rules(); }
  @Post() create(@Body() dto: CreateLicenseRequestDto, @CurrentUser() user: JwtUser) { return this.licenses.create(dto, user); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateLicenseRequestDto, @CurrentUser() user: JwtUser) { return this.licenses.update(id, dto, user); }
  @Patch(':id/approve') @Roles(Role.ADMIN) approve(@Param('id') id: string, @CurrentUser() user: JwtUser) { return this.licenses.approve(id, user); }
  @Patch(':id/reject') @Roles(Role.ADMIN) reject(@Param('id') id: string, @CurrentUser() user: JwtUser) { return this.licenses.reject(id, user); }
  @Post(':id/certificate')
  @UseInterceptors(FileInterceptor('certificate', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadCertificate(@Param('id') id: string, @UploadedFile() file: any, @CurrentUser() user: JwtUser) {
    return this.licenses.uploadCertificate(id, file, user);
  }
  @Get(':id/certificate')
  async downloadCertificate(@Param('id') id: string, @CurrentUser() user: JwtUser, @Res() res: any) {
    const file = await this.licenses.downloadCertificate(id, user);
    const mime = file.extension === '.pdf' ? 'application/pdf' : file.extension === '.png' ? 'image/png' : 'image/jpeg';
    const fallbackName = file.filename.replace(/[^A-Za-z0-9._-]/g, '_').replace(/["\\\r\n]/g, '') || `certificado${file.extension}`;
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(file.buffer);
  }
  @Post(':id/generate-pdf') @Roles(Role.ADMIN) @Header('Content-Type', 'application/pdf')
  async generatePdf(@Param('id') id: string, @Body() dto: RenderLicensePdfDto, @Res() res: any) {
    const pdf = await this.articles.renderLicensePdf(id, dto);
    res.setHeader('Content-Disposition', 'inline; filename="licencia.pdf"');
    res.send(pdf);
  }
  @Delete() @Roles(Role.ADMIN) clear(@CurrentUser() user: JwtUser) { return this.licenses.clear(user); }
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: JwtUser) { return this.licenses.remove(id, user); }
}
