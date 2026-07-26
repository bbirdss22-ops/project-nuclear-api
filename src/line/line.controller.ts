import {
  Controller,
  Post,
  Logger,
  HttpCode,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { LineService } from './line.service.js';
import { LineSignatureGuard } from './guards/line-signature.guard.js';
import type { LineWebhookEventDto } from './dto/line-webhook.dto.js';

@ApiTags('Line')
@Controller('line')
export class LineController {
  private readonly logger = new Logger(LineController.name);

  constructor(private readonly lineService: LineService) {}

  private parseBody(rawBody: Buffer | string): LineWebhookEventDto {
    const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : rawBody;
    try {
      return JSON.parse(raw) as LineWebhookEventDto;
    } catch {
      throw new BadRequestException('Invalid JSON body');
    }
  }

  @Post('webhook')
  @HttpCode(200)
  @UseGuards(LineSignatureGuard)
  @ApiOperation({ summary: 'Line Messaging API webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 403, description: 'Invalid signature' })
  async webhook(
    @Req() request: Request,
  ): Promise<{ status: string }> {
    const body: LineWebhookEventDto = this.parseBody(request.body);

    this.logger.log(
      `📩 Webhook received: ${body.events?.length ?? 0} events from ${body.destination}`,
    );

    if (!body.events || body.events.length === 0) {
      this.logger.warn('Webhook received with no events');
      return { status: 'ok' };
    }

    for (const event of body.events) {
      try {
        const replyRequest = await this.lineService.processEvent(event);
        if (replyRequest?.replyToken) {
          this.logger.log(`✅ Processed event ${event.type}`);
        }
      } catch (error) {
        this.logger.error(
          `❌ Error processing ${event.type} event: ${(error as Error).message}`,
        );
      }
    }

    return { status: 'ok' };
  }
}
