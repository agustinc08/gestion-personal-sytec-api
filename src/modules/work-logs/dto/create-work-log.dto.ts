import { ActivityType } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateWorkLogDto {
  @IsOptional() @IsString() employeeId?: string;
  @IsOptional() @IsString() projectId?: string;
  @IsString() title!: string;
  @IsString() description!: string;
  @IsDateString() date!: string;
  @IsString() mode!: string;
  @IsOptional() @IsEnum(ActivityType) activityType?: ActivityType;
  @IsOptional() @IsNumber() hours?: number;
}
