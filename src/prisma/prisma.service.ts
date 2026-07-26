import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    await this.seedAdminUsers();
  }

  private async seedAdminUsers() {
    try {
      const hash = await bcrypt.hash('admin123', 10);

      for (let i = 1; i <= 5; i++) {
        const username = `admin${i}`;
        const existing = await this.user.findUnique({ where: { username } });

        if (!existing) {
          await this.user.create({
            data: {
              username,
              password: hash,
              role: i === 1 ? 'superadmin' : 'admin',
            },
          });
          this.logger.log(`Created admin user: ${username}`);
        } else {
          // Always update password hash to ensure it matches the known hash
          await this.user.update({
            where: { username },
            data: { password: hash },
          });
          this.logger.log(`Updated password for: ${username}`);
        }
      }
      this.logger.log('Admin user seeding completed');
    } catch (error) {
      this.logger.warn(`Admin seed skipped (non-fatal): ${(error as Error).message}`);
    }
  }
}
