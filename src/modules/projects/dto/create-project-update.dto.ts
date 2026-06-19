import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ActivityType } from '@prisma/client';

export class CreateProjectUpdateDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsString() content!: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() blockers?: string;
  @IsOptional() @IsString() nextStep?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) hours?: number;
  @IsOptional() @IsEnum(ActivityType) activityType?: ActivityType;
  @IsOptional() @IsString() authorName?: string;
}
