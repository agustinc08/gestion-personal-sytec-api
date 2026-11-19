import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateWorkLogDto } from './create-work-log.dto';

export class UpdateWorkLogDto extends PartialType(OmitType(CreateWorkLogDto, ['employeeId'] as const)) {
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}
