import { IsObject, IsOptional } from 'class-validator';

export class RenderLicensePdfDto {
  @IsOptional() @IsObject() values?: Record<string, string>;
}
