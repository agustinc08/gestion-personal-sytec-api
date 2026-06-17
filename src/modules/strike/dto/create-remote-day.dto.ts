import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateRemoteDayDto {
  @IsString() employeeId!: string;
  @IsString() day!: string;
  @IsOptional() @IsDateString() date?: string;
}
