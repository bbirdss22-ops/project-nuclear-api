import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login — รับ JWT token' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login สำเร็จ ได้ access_token + user info' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.username, loginDto.password);
  }

  @Get('registration-token/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate registration token from LINE' })
  @ApiResponse({ status: 200, description: 'Token valid' })
  @ApiResponse({ status: 404, description: 'Token not found or expired' })
  async validateRegistrationToken(@Param('token') token: string) {
    return this.authService.validateRegistrationToken(token);
  }

  @Post('registration-token/:token/consume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark registration token as used after customer creation' })
  @ApiResponse({ status: 200, description: 'Token consumed' })
  @ApiResponse({ status: 404, description: 'Token not found' })
  async consumeRegistrationToken(
    @Param('token') token: string,
    @Body('customerId') customerId: string,
  ) {
    return this.authService.consumeRegistrationToken(token, customerId);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'เปลี่ยนรหัสผ่าน (ต้องใช้ JWT token)' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Current password is incorrect' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto.currentPassword, dto.newPassword);
  }
}
