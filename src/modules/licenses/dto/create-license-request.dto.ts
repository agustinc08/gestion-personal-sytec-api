import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateLicenseRequestDto {
  @IsOptional() @IsString() employeeId?: string;
  @IsOptional() @IsString() articleId?: string;
  @IsString() article!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsString() reason!: string;
  @IsOptional() @IsString() certificateName?: string;
  @IsOptional() @IsString() status?: string;
}
