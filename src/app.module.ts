import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CustomerModule } from './customer/customer.module.js';
import { LineModule } from './line/line.module.js';
import { UserProfileModule } from './user-profile/user-profile.module.js';
import { StorageModule } from './storage/storage.module.js';
import { AppController } from './app.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    CustomerModule,
    LineModule,
    UserProfileModule,
    StorageModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
