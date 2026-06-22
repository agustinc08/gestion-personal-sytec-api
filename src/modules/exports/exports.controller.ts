import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ExportsService } from './exports.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}
  private send(res: any, buffer: Buffer, name: string) { res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.setHeader('Content-Disposition', `attachment; filename="${name}_${new Date().toISOString().slice(0, 10)}.xlsx"`); res.send(buffer); }
  @Get('employees') async employees(@Query() q: Record<string, string>, @Res() r: any) { this.send(r, await this.exportsService.employees(q), 'empleados'); }
  @Get('licenses') async licenses(@Query() q: Record<string, string>, @Res() r: any) { this.send(r, await this.exportsService.licenses(q), 'licencias'); }
  @Get('work-logs') async workLogs(@Query() q: Record<string, string>, @Res() r: any) { this.send(r, await this.exportsService.workLogs(q), 'parte-diario'); }
  @Get('projects') async projects(@Query() q: Record<string, string>, @Res() r: any) { this.send(r, await this.exportsService.projects(q), 'proyectos'); }
  @Get('dependencies') async dependencies(@Res() r: any) { this.send(r, await this.exportsService.dependencies(), 'dependencias'); }
  @Get('technology-stats') async technologyStats(@Res() r: any) { this.send(r, await this.exportsService.technologyStats(), 'tecnologias'); }
  @Get('strike-duty') async strikeDuty(@Res() r: any) { this.send(r, await this.exportsService.strikeDuty(), 'guardias-paro'); }
  @Get('audit-logs') async auditLogs(@Query() q: Record<string, string>, @Res() r: any) { this.send(r, await this.exportsService.auditLogs(q), 'auditoria'); }
}
