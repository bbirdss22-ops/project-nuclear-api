import { Module } from '@nestjs/common';
import { UserProfileController } from './user-profile.controller.js';
import { UserProfileService } from './user-profile.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [UserProfileController],
  providers: [UserProfileService],
  exports: [UserProfileService],
})
export class UserProfileModule {}
