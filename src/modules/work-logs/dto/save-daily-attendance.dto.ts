import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

export class SaveDailyAttendanceDto {
  @IsOptional() @IsString() employeeId?: string;
  @IsDateString() date!: string;
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) entryTime?: string;
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) exitTime?: string;
}