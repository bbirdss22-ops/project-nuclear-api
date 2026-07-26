import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { validateSignature, LINE_SIGNATURE_HTTP_HEADER_NAME } from '@line/bot-sdk';

@Injectable()
export class LineSignatureGuard implements CanActivate {
  private readonly logger = new Logger(LineSignatureGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
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

    // bodyParser.raw middleware sets req.body to Buffer — use it for signature validation
    const rawBody = request.body;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      this.logger.warn('Raw body not available (not a Buffer) for signature validation');
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
