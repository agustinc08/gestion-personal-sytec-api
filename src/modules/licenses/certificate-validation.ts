import { BadRequestException, NotFoundException } from '@nestjs/common';
import { extname } from 'path';
import { Role } from '@prisma/client';
import type { JwtUser } from '../auth/decorators/current-user.decorator';

const maxCertificateSize = 5 * 1024 * 1024;
const allowedTypes: Record<string, { mime: string; signature?: Buffer }> = {
  '.pdf': { mime: 'application/pdf', signature: Buffer.from('%PDF-') },
  '.jpg': { mime: 'image/jpeg' },
  '.jpeg': { mime: 'image/jpeg' },
  '.png': { mime: 'image/png', signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
};

export function validateCertificate(file: { buffer?: Buffer; size?: number; mimetype?: string; originalname?: string }) {
  const buffer = file?.buffer;
  if (!buffer || buffer.length === 0 || buffer.length > maxCertificateSize || (file.size ?? buffer.length) > maxCertificateSize) {
    throw new BadRequestException('El archivo es obligatorio y no puede superar 5 MB');
  }
  const originalName = String(file.originalname || 'certificado').replace(/[\\/\r\n\0]/g, '').trim().slice(0, 150);
  const extension = extname(originalName).toLowerCase();
  const rule = allowedTypes[extension];
  if (!rule || file.mimetype !== rule.mime) throw new BadRequestException('Solo se permiten certificados PDF, JPG o PNG');

  const validSignature = extension === '.jpg' || extension === '.jpeg'
    ? buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    : !!rule.signature && buffer.subarray(0, rule.signature.length).equals(rule.signature);
  if (!validSignature) throw new BadRequestException('El contenido del archivo no coincide con su formato');
  return { originalName, extension };
}

export function assertCertificateAccess(employeeId: string, user: JwtUser) {
  if (user.role !== Role.ADMIN && employeeId !== user.employeeId) throw new NotFoundException('Certificado no encontrado');
}
