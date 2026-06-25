import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateEmployeeDto {
  @IsString() name!: string;
  @IsOptional() @IsEmail() email?: string;
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional() @IsString() avatar?: string;
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional() @IsString() dependency?: string;
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional() @IsString() dependencyId?: string;
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional() @IsString() position?: string;
  @IsString() @IsNotEmpty() cuil!: string;
  @IsOptional() @IsInt() @Min(0) totalLicenseDays?: number;
  @IsOptional() @IsInt() strikeDutyOrder?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) remoteDaysAssigned?: string[];
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsBoolean() mustChangePassword?: boolean;
  @IsOptional() @IsBoolean() isAdmin?: boolean;
}
