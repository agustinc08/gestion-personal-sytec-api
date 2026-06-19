import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateLicenseArticleFieldDto {
  @IsString() key!: string;
  @IsString() label!: string;
  @IsOptional() @IsIn(['TEXT', 'DATE', 'NUMBER', 'MULTILINE']) type?: string;
  @IsOptional() @IsNumber() @Min(1) page?: number;
  @IsNumber() x!: number;
  @IsNumber() y!: number;
  @IsOptional() @IsNumber() width?: number;
  @IsOptional() @IsNumber() height?: number;
  @IsOptional() @IsNumber() fontSize?: number;
  @IsOptional() @IsString() defaultValue?: string;
  @IsOptional() @IsBoolean() required?: boolean;
}
