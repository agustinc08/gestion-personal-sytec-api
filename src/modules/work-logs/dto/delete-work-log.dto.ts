import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteWorkLogDto {
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}
