import { PartialType } from '@nestjs/mapped-types';
import { CreateLicenseArticleDto } from './create-license-article.dto';

export class UpdateLicenseArticleDto extends PartialType(CreateLicenseArticleDto) {}
