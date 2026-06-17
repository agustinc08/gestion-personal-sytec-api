import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateStrikeConfigDto {
  @IsOptional() @IsDateString() nextDate?: string;
  @IsOptional() @IsString() nextCoverEmployeeId?: string;
  @IsOptional() @IsDateString() lastDate?: string;
  @IsOptional() @IsString() lastCoverEmployeeId?: string;
  @IsOptional() @IsString() notes?: string;
}
