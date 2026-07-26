import {
  Controller,
  Post,
  Logger,
  HttpCode,
  Req,
  UseGuards,
  BadRequestException,
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
   * Parse the raw webhook body (Buffer or string) into a parsed object.
   * This avoids the global ValidationPipe which can break on raw body payloads.
   */
  private parseBody(rawBody: Buffer | string): LineWebhookEventDto {
    const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : rawBody;
    try {
      return JSON.parse(raw) as LineWebhookEventDto;
    } catch {
      throw new BadRequestException('Invalid JSON body');
    }
  }

  /**
   * POST /api/line/webhook
   * Receive LINE webhook events
   */
  @Post('webhook')
  @HttpCode(200)
  @UseGuards(LineSignatureGuard)
  async webhook(
    @Req() request: Request,
  ): Promise<{ status: string }> {
    // bodyParser.raw middleware sets req.body to a Buffer
    // Parse it here to avoid the global ValidationPipe interfering
    const body: LineWebhookEventDto = this.parseBody(request.body);

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
