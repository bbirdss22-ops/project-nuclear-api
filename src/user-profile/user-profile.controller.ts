import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { UserProfileService } from './user-profile.service.js';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto.js';

@ApiTags('User Profile')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('user-profile')
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile (auto-create if not exists)' })
  @ApiResponse({ status: 200, description: 'Profile data' })
  async getMyProfile(@CurrentUser('id') userId: string) {
    return this.userProfileService.getProfile(userId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async updateMyProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserProfileDto,
  ) {
    return this.userProfileService.updateProfile(userId, dto);
  }
}
