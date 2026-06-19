import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateLicenseArticleDto {
  @IsString() code!: string;
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
