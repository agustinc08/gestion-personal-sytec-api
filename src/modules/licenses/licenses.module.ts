import { Module } from '@nestjs/common';
import { LicenseArticleFieldsController, LicenseArticlesController } from './license-articles.controller';
import { LicenseArticlesService } from './license-articles.service';
import { LicensesController } from './licenses.controller';
import { LicensesService } from './licenses.service';

@Module({
  controllers: [LicensesController, LicenseArticlesController, LicenseArticleFieldsController],
  providers: [LicensesService, LicenseArticlesService],
  exports: [LicensesService, LicenseArticlesService],
})
export class LicensesModule {}
