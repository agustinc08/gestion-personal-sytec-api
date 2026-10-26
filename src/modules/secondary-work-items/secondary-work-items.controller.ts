import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateSecondaryWorkItemDto } from './dto/create-secondary-work-item.dto';
import { UpdateSecondaryWorkItemDto } from './dto/update-secondary-work-item.dto';
import { SecondaryWorkItemsService } from './secondary-work-items.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('secondary-work-items')
export class SecondaryWorkItemsController {
  constructor(private readonly items: SecondaryWorkItemsService) {}

  @Get() findAll() { return this.items.findAll(); }
  @Post() create(@Body() dto: CreateSecondaryWorkItemDto, @CurrentUser() user: JwtUser) { return this.items.create(dto, user); }
  @Patch(':id') @Roles(Role.ADMIN) update(@Param('id') id: string, @Body() dto: UpdateSecondaryWorkItemDto, @CurrentUser() user: JwtUser) { return this.items.update(id, dto, user); }
  @Get(':id/work-logs') workLogs(@Param('id') id: string) { return this.items.workLogs(id); }
}
