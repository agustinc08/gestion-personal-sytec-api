import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateWorkLogDto {
  @IsOptional() @IsString() employeeId?: string;
  @IsString() title!: string;
  @IsString() description!: string;
  @IsDateString() date!: string;
  @IsString() mode!: string;
}
