import { SecondaryWorkItemStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateSecondaryWorkItemDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(SecondaryWorkItemStatus) status?: SecondaryWorkItemStatus;
}
