import { PartialType } from '@nestjs/mapped-types';
import { CreateLicenseRequestDto } from './create-license-request.dto';

export class UpdateLicenseRequestDto extends PartialType(CreateLicenseRequestDto) {}
