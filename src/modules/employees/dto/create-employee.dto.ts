import { IsArray, IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateEmployeeDto {
  @IsString() name!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() avatar?: string;
  @IsString() dependency!: string;
  @IsOptional() @IsString() position?: string;
  @IsString() @IsNotEmpty() cuil!: string;
  @IsOptional() @IsInt() @Min(0) totalLicenseDays?: number;
  @IsOptional() @IsInt() strikeDutyOrder?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) remoteDaysAssigned?: string[];
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsBoolean() mustChangePassword?: boolean;
  @IsOptional() @IsBoolean() isAdmin?: boolean;
}
