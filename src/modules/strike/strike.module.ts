import { Module } from '@nestjs/common';
import { StrikeController } from './strike.controller';
import { StrikeService } from './strike.service';

@Module({ controllers: [StrikeController], providers: [StrikeService] })
export class StrikeModule {}
