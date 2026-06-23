import { ActivityType } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Matches } from 'class-validator';

export class CreateWorkLogDto {
  @IsOptional() @IsString() employeeId?: string;
  @IsOptional() @IsString() projectId?: string;
  @IsString() title!: string;
  @IsString() description!: string;
  @IsDateString() date!: string;
  @IsString() mode!: string;
  @IsOptional() @IsEnum(ActivityType) activityType?: ActivityType;
  @IsOptional() @IsNumber() hours?: number;
  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) entryTime?: string;
  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) exitTime?: string;
}
