import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LicenseFieldType } from '@prisma/client';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLicenseArticleFieldDto } from './dto/create-license-article-field.dto';
import { CreateLicenseArticleDto } from './dto/create-license-article.dto';
import { RenderLicensePdfDto } from './dto/render-license-pdf.dto';
import { UpdateLicenseArticleFieldDto } from './dto/update-license-article-field.dto';
import { UpdateLicenseArticleDto } from './dto/update-license-article.dto';

@Injectable()
export class LicenseArticlesService {
  constructor(private prisma: PrismaService) {}

  private cleanCode(code: string) {
    return code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  }

  private fieldType(value?: string) {
    return ({
      TEXT: LicenseFieldType.TEXT,
      DATE: LicenseFieldType.DATE,
      NUMBER: LicenseFieldType.NUMBER,
      MULTILINE: LicenseFieldType.MULTILINE,
    }[value || 'TEXT'] || LicenseFieldType.TEXT);
  }

  async findAll(includeInactive = false) {
    return this.prisma.licenseArticle.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: { fields: { orderBy: { createdAt: 'asc' } } },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: string) {
    const article = await this.prisma.licenseArticle.findUnique({
      where: { id },
      include: { fields: { orderBy: { createdAt: 'asc' } } },
    });
    if (!article) throw new NotFoundException('Articulo de licencia no encontrado');
    return article;
  }

  async create(dto: CreateLicenseArticleDto) {
    return this.prisma.licenseArticle.create({
      data: {
        code: this.cleanCode(dto.code),
        title: dto.title,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
      include: { fields: true },
    });
  }

  async update(id: string, dto: UpdateLicenseArticleDto) {
    await this.findOne(id);
    return this.prisma.licenseArticle.update({
      where: { id },
      data: {
        code: dto.code ? this.cleanCode(dto.code) : undefined,
        title: dto.title,
        description: dto.description,
        isActive: dto.isActive,
      },
      include: { fields: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.licenseArticle.update({ where: { id }, data: { isActive: false } });
    return { status: 'success' };
  }

  async uploadTemplate(id: string, file: any) {
    const article = await this.findOne(id);
    if (!file) throw new BadRequestException('PDF requerido');
    if (file.mimetype !== 'application/pdf') throw new BadRequestException('Solo se permiten archivos PDF');

    const uploadDir = join(process.cwd(), 'uploads', 'license-templates');
    await mkdir(uploadDir, { recursive: true });
    const filename = `${article.code}-${Date.now()}.pdf`;
    await writeFile(join(uploadDir, filename), file.buffer);

    return this.prisma.licenseArticle.update({
      where: { id },
      data: {
        templatePdfPath: `/uploads/license-templates/${filename}`,
        templatePdfName: file.originalname || filename,
      },
      include: { fields: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async fields(articleId: string) {
    await this.findOne(articleId);
    return this.prisma.licenseArticleField.findMany({ where: { articleId }, orderBy: { createdAt: 'asc' } });
  }

  async createField(articleId: string, dto: CreateLicenseArticleFieldDto) {
    await this.findOne(articleId);
    return this.prisma.licenseArticleField.create({
      data: {
        articleId,
        key: dto.key.trim(),
        label: dto.label,
        type: this.fieldType(dto.type),
        page: dto.page || 1,
        x: dto.x,
        y: dto.y,
        width: dto.width,
        height: dto.height,
        fontSize: dto.fontSize || 10,
        defaultValue: dto.defaultValue,
        required: dto.required || false,
      },
    });
  }

  async updateField(id: string, dto: UpdateLicenseArticleFieldDto) {
    const current = await this.prisma.licenseArticleField.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Campo no encontrado');
    return this.prisma.licenseArticleField.update({
      where: { id },
      data: {
        key: dto.key?.trim(),
        label: dto.label,
        type: dto.type ? this.fieldType(dto.type) : undefined,
        page: dto.page,
        x: dto.x,
        y: dto.y,
        width: dto.width,
        height: dto.height,
        fontSize: dto.fontSize,
        defaultValue: dto.defaultValue,
        required: dto.required,
      },
    });
  }

  async removeField(id: string) {
    const current = await this.prisma.licenseArticleField.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Campo no encontrado');
    await this.prisma.licenseArticleField.delete({ where: { id } });
    return { status: 'success' };
  }

  async renderArticlePdf(articleId: string, dto: RenderLicensePdfDto) {
    const article = await this.findOne(articleId);
    if (!article.templatePdfPath) throw new BadRequestException('El articulo no tiene plantilla PDF cargada');
    return this.renderPdf(article, dto.values || {});
  }

  async renderLicensePdf(licenseId: string, dto: RenderLicensePdfDto) {
    const license = await this.prisma.licenseRequest.findFirst({
      where: { id: licenseId, deletedAt: null },
      include: { employee: true, licenseArticle: { include: { fields: true } } },
    });
    if (!license) throw new NotFoundException('Licencia no encontrada');
    if (!license.licenseArticle) throw new BadRequestException('La licencia no tiene articulo asociado');

    const [firstName, ...lastParts] = license.employee.name.split(' ');
    const days = Math.max(1, Math.round((+license.endDate - +license.startDate) / 86400000) + 1);
    const defaults = {
      employeeName: firstName,
      employeeLastName: lastParts.join(' '),
      fullName: license.employee.name,
      cuil: license.employee.cuil,
      position: license.employee.position || '',
      dependency: license.employee.dependency,
      startDate: license.startDate.toISOString().slice(0, 10),
      endDate: license.endDate.toISOString().slice(0, 10),
      days: String(days),
      article: license.article,
      notes: license.reason,
    };

    return this.renderPdf(license.licenseArticle, { ...defaults, ...(dto.values || {}) });
  }

  private async renderPdf(article: any, values: Record<string, string>) {
    const templatePath = join(process.cwd(), article.templatePdfPath.replace(/^\/uploads\//, 'uploads/'));
    const templateBytes = await readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (const field of article.fields || []) {
      const page = pdfDoc.getPage(Math.max(0, field.page - 1));
      const text = String(values[field.key] ?? field.defaultValue ?? '');
      if (field.required && !text) throw new BadRequestException(`Falta el valor requerido: ${field.label}`);
      if (!text) continue;

      const lines = field.type === LicenseFieldType.MULTILINE ? text.split(/\r?\n/) : [text];
      lines.forEach((line, index) => {
        page.drawText(line, {
          x: field.x,
          y: field.y - index * (field.fontSize + 2),
          size: field.fontSize,
          font,
          color: rgb(0, 0, 0),
          maxWidth: field.width || undefined,
        });
      });
    }

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  }
}
