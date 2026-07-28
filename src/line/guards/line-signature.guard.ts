import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Injectable, CanActivate, ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { validateSignature, LINE_SIGNATURE_HTTP_HEADER_NAME } from '@line/bot-sdk';

/**
 * Express Request extended with `rawBody` by NestFactory `{ rawBody: true }`.
 */
interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

@Injectable()
export class LineSignatureGuard implements CanActivate {
  private readonly logger = new Logger(LineSignatureGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithRawBody>();
    const channelSecret = this.configService.get<string>('LINE_CHANNEL_SECRET');

    // If LINE_CHANNEL_SECRET is not configured, skip verification
    if (!channelSecret || channelSecret === '') {
      this.logger.warn(
        '⚠️ LINE_CHANNEL_SECRET is not configured — skipping signature verification',
      );
      return true;
    }

    const signature = request.headers[LINE_SIGNATURE_HTTP_HEADER_NAME] as string;
    if (!signature) {
      this.logger.warn('Missing x-line-signature header');
      throw new UnauthorizedException('Missing LINE signature');
    }

    // rawBody is preserved as Buffer via NestFactory `{ rawBody: true }`
    const rawBody = request.rawBody;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      this.logger.warn('Raw body not available for signature validation');
      throw new UnauthorizedException('Raw body required for signature validation');
    }

    const isValid = validateSignature(rawBody, channelSecret, signature);
    if (!isValid) {
      this.logger.warn('Invalid LINE signature');
      throw new UnauthorizedException('Invalid LINE signature');
    }

    return true;
  }
}
