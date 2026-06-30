import { Module } from '@nestjs/common';
import { SecondaryWorkItemsController } from './secondary-work-items.controller';
import { SecondaryWorkItemsService } from './secondary-work-items.service';

@Module({ controllers: [SecondaryWorkItemsController], providers: [SecondaryWorkItemsService], exports: [SecondaryWorkItemsService] })
export class SecondaryWorkItemsModule {}
