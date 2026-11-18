import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { assertCertificateAccess, validateCertificate } from './certificate-validation';

describe('license certificate validation', () => {
  it('accepts matching PDF, JPEG and PNG signatures', () => {
    assert.equal(validateCertificate({ originalname: 'doc.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.7') }).extension, '.pdf');
    assert.equal(validateCertificate({ originalname: 'photo.jpg', mimetype: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]) }).extension, '.jpg');
    assert.equal(validateCertificate({ originalname: 'photo.png', mimetype: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) }).extension, '.png');
  });

  it('rejects mismatched MIME, extension, file signatures and oversized content', () => {
    assert.throws(() => validateCertificate({ originalname: 'bad.pdf', mimetype: 'image/png', buffer: Buffer.from('%PDF-1.7') }), BadRequestException);
    assert.throws(() => validateCertificate({ originalname: 'bad.png', mimetype: 'image/png', buffer: Buffer.from('not a png') }), BadRequestException);
    assert.throws(() => validateCertificate({ originalname: 'bad.exe', mimetype: 'application/octet-stream', buffer: Buffer.from('MZ') }), BadRequestException);
    assert.throws(() => validateCertificate({ originalname: 'big.pdf', mimetype: 'application/pdf', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) }), BadRequestException);
  });

  it('allows the owner and ADMIN, but hides another employee certificate', () => {
    assert.doesNotThrow(() => assertCertificateAccess('employee-a', { id: 'user-a', cuil: '', role: Role.EMPLOYEE, employeeId: 'employee-a' }));
    assert.throws(() => assertCertificateAccess('employee-b', { id: 'user-a', cuil: '', role: Role.EMPLOYEE, employeeId: 'employee-a' }), NotFoundException);
    assert.doesNotThrow(() => assertCertificateAccess('employee-b', { id: 'admin', cuil: '', role: Role.ADMIN }));
  });
});
