import { IsOptional, IsString } from 'class-validator';

export class CreateSecondaryWorkItemDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
}
