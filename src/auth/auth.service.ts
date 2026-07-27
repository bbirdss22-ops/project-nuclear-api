import { Injectable, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }

  async validateJwtPayload(payload: { sub: string; username: string; role: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async validateRegistrationToken(token: string) {
    const record = await this.prisma.registrationToken.findUnique({
      where: { id: token },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new NotFoundException('Invalid or expired registration token');
    }

    // Check if user already registered
    const existingCustomer = await this.prisma.customer.findFirst({
      where: { lineUserId: record.lineUserId },
    });

    return {
      valid: true,
      lineUserId: record.lineUserId,
      alreadyRegistered: !!existingCustomer,
    };
  }

  async consumeRegistrationToken(token: string, customerId: string) {
    const record = await this.prisma.registrationToken.findUnique({
      where: { id: token },
    });

    if (!record) {
      throw new NotFoundException('Registration token not found');
    }

    await this.prisma.registrationToken.update({
      where: { id: token },
      data: {
        usedAt: new Date(),
        customerId,
      },
    });

    return { message: 'Token consumed successfully' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }
}
