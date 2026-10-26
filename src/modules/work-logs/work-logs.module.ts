import { Module } from '@nestjs/common';
import { WorkLogsController } from './work-logs.controller';
import { WorkLogsService } from './work-logs.service';
import { SecondaryWorkItemsModule } from '../secondary-work-items/secondary-work-items.module';

@Module({ imports: [SecondaryWorkItemsModule], controllers: [WorkLogsController], providers: [WorkLogsService] })
export class WorkLogsModule {}
