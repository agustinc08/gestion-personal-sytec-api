import { Module } from '@nestjs/common';
import { DeploymentsController, ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({ controllers: [ProjectsController, DeploymentsController], providers: [ProjectsService], exports: [ProjectsService] })
export class ProjectsModule {}
