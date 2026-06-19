import { PartialType } from '@nestjs/mapped-types';
import { CreateLicenseArticleFieldDto } from './create-license-article-field.dto';

export class UpdateLicenseArticleFieldDto extends PartialType(CreateLicenseArticleFieldDto) {}
