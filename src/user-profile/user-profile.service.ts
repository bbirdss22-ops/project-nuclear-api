import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto.js';

@Injectable()
export class UserProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      // Auto-create profile if not exists
      return this.prisma.userProfile.create({
        data: { userId },
      });
    }

    return profile;
  }

  async updateProfile(userId: string, dto: UpdateUserProfileDto) {
    // Ensure profile exists
    await this.getProfile(userId);

    return this.prisma.userProfile.update({
      where: { userId },
      data: dto,
    });
  }
}
