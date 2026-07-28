import {
  Controller,
  Post,
  Logger,
  HttpCode,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LineService } from './line.service.js';
import { LineSignatureGuard } from './guards/line-signature.guard.js';
import type { LineWebhookEventDto } from './dto/line-webhook.dto.js';

/**
 * Express Request extended with parsed JSON body and rawBody Buffer
 * (via NestFactory `{ rawBody: true }`).
 */
interface RequestWithJsonBody {
  body: LineWebhookEventDto;
  rawBody?: Buffer;
}

@ApiTags('Line')
@Controller('line')
export class LineController {
  private readonly logger = new Logger(LineController.name);

  constructor(private readonly lineService: LineService) {}

  @Post('webhook')
  @HttpCode(200)
  @UseGuards(LineSignatureGuard)
  @ApiOperation({ summary: 'Line Messaging API webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 403, description: 'Invalid signature' })
  async webhook(
    @Req() request: RequestWithJsonBody,
  ): Promise<{ status: string }> {
    const body = request.body;

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
        if (replyRequest && replyRequest.replyToken) {
          await this.lineService.replyMessage(replyRequest);
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
