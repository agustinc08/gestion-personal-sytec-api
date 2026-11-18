import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from './decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AllowPasswordChange } from './decorators/allow-password-change.decorator';
import { LoginRateLimitGuard } from './guards/login-rate-limit.guard';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  @UseGuards(LoginRateLimitGuard)
  login(@Body() dto: LoginDto, @Req() request: any) {
    return this.auth.login(dto, request.ip || 'unknown');
  }

  @UseGuards(JwtAuthGuard)
  @AllowPasswordChange()
  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.auth.me(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @AllowPasswordChange()
  @Post('change-password')
  changePassword(@CurrentUser() user: JwtUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @AllowPasswordChange()
  @Post('logout')
  logout() {
    return { status: 'success' };
  }
}
