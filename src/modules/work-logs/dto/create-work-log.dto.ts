import { ActivityType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateWorkLogDto {
  @IsOptional() @IsString() employeeId?: string;
  @IsOptional() @IsString() projectId?: string;
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional() @IsString() secondaryWorkItemId?: string;
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional() @IsString() secondaryWorkItemName?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) title!: string;
  @IsString() @IsNotEmpty() @MaxLength(5000) description!: string;
  @IsDateString() date!: string;
  @IsIn(['presencial', 'remoto', 'mixto', 'licencia', 'ONSITE', 'REMOTE', 'MIXED', 'LICENSE']) mode!: string;
  @IsOptional() @IsEnum(ActivityType) activityType?: ActivityType;
  @IsOptional() @IsNumber() @Min(0) @Max(24) hours?: number;
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) entryTime?: string;
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) exitTime?: string;
}
