import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { LineService } from './line.service.js';
import { LineSignatureGuard } from './guards/line-signature.guard.js';
import type { LineWebhookEventDto } from './dto/line-webhook.dto.js';

@Controller('line')
export class LineController {
  private readonly logger = new Logger(LineController.name);

  constructor(private readonly lineService: LineService) {}

  /**
   * POST /api/line/webhook
   * Receive LINE webhook events
   */
  @Post('webhook')
  @HttpCode(200)
  @UseGuards(LineSignatureGuard)
  async webhook(
    @Req() request: Request,
    @Body() body: LineWebhookEventDto,
  ): Promise<{ status: string }> {
    this.logger.log(
      `📩 Webhook received: ${body.events?.length ?? 0} events from ${body.destination}`,
    );

    if (!body.events || body.events.length === 0) {
      this.logger.warn('Webhook received with no events');
      return { status: 'ok' };
    }

    // Process each event sequentially
    for (const event of body.events) {
      try {
        const replyRequest = await this.lineService.processEvent(event);

        // If the event handler returned a reply, send it
        if (replyRequest?.replyToken) {
          // We handle replying via the LineService or directly here
          // For now we just log — actual reply through Messaging API
          // happens via the reply token
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
