import { ActivityType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Matches } from 'class-validator';

export class CreateWorkLogDto {
  @IsOptional() @IsString() employeeId?: string;
  @IsOptional() @IsString() projectId?: string;
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional() @IsString() secondaryWorkItemId?: string;
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional() @IsString() secondaryWorkItemName?: string;
  @IsString() title!: string;
  @IsString() description!: string;
  @IsDateString() date!: string;
  @IsString() mode!: string;
  @IsOptional() @IsEnum(ActivityType) activityType?: ActivityType;
  @IsOptional() @IsNumber() hours?: number;
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) entryTime?: string;
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) exitTime?: string;
}
