import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtUser) { return this.notifications.findAll(user); }

  @Patch('read-all')
  readAll(@CurrentUser() user: JwtUser) { return this.notifications.readAll(user); }

  @Patch(':id/read')
  read(@Param('id') id: string, @CurrentUser() user: JwtUser) { return this.notifications.read(id, user); }
}
