import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateLicenseArticleFieldDto } from './dto/create-license-article-field.dto';
import { CreateLicenseArticleDto } from './dto/create-license-article.dto';
import { RenderLicensePdfDto } from './dto/render-license-pdf.dto';
import { UpdateLicenseArticleFieldDto } from './dto/update-license-article-field.dto';
import { UpdateLicenseArticleDto } from './dto/update-license-article.dto';
import { LicenseArticlesService } from './license-articles.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('license-articles')
export class LicenseArticlesController {
  constructor(private articles: LicenseArticlesService) {}

  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.articles.findAll(includeInactive === 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articles.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateLicenseArticleDto) {
    return this.articles.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateLicenseArticleDto) {
    return this.articles.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.articles.remove(id);
  }

  @Post(':id/template')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('template', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadTemplate(@Param('id') id: string, @UploadedFile() file: any) {
    return this.articles.uploadTemplate(id, file);
  }

  @Get(':id/fields')
  @Roles(Role.ADMIN)
  fields(@Param('id') id: string) {
    return this.articles.fields(id);
  }

  @Post(':id/fields')
  @Roles(Role.ADMIN)
  createField(@Param('id') id: string, @Body() dto: CreateLicenseArticleFieldDto) {
    return this.articles.createField(id, dto);
  }

  @Post(':id/render-pdf')
  @Roles(Role.ADMIN)
  @Header('Content-Type', 'application/pdf')
  async renderPdf(@Param('id') id: string, @Body() dto: RenderLicensePdfDto, @Res() res: any) {
    const pdf = await this.articles.renderArticlePdf(id, dto);
    res.setHeader('Content-Disposition', 'inline; filename="licencia.pdf"');
    res.send(pdf);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('license-article-fields')
export class LicenseArticleFieldsController {
  constructor(private articles: LicenseArticlesService) {}

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateLicenseArticleFieldDto) {
    return this.articles.updateField(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.articles.removeField(id);
  }
}
