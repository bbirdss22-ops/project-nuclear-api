import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { LineBotClient, messagingApi } from '@line/bot-sdk';
import type { LineEventDto } from './dto/line-webhook.dto.js';

@Injectable()
export class LineService {
  private readonly logger = new Logger(LineService.name);
  private client: LineBotClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const accessToken = this.configService.get<string>('LINE_ACCESS_TOKEN');
    if (accessToken && accessToken !== '') {
      this.client = LineBotClient.fromChannelAccessToken({
        channelAccessToken: accessToken,
      });
      this.logger.log('✅ LINE Messaging API client initialized');
    } else {
      this.logger.warn(
        '⚠️ LINE_ACCESS_TOKEN not configured — pushMessage will be unavailable',
      );
    }
  }

  /**
   * Log a LINE event to the database
   */
  async logEvent(lineUserId: string | null, eventType: string, raw: unknown): Promise<void> {
    try {
      await this.prisma.lineEvent.create({
        data: {
          lineUserId: lineUserId ?? undefined,
          eventType,
          raw: raw as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log LINE event: ${(error as Error).message}`);
    }
  }

  /**
   * Handle postback events
   */
  async handlePostback(
    lineUserId: string | undefined,
    replyToken: string | undefined,
    postbackData: string,
    postbackParams: Record<string, string> | undefined,
  ): Promise<messagingApi.ReplyMessageRequest | null> {
    this.logger.log(`📩 Postback received: data="${postbackData}", params=${JSON.stringify(postbackParams)}`);

    const logData = { data: postbackData, params: postbackParams };
    await this.logEvent(lineUserId ?? null, 'postback', logData);

    if (postbackData.startsWith('product_order_')) {
      const productId = postbackData.replace('product_order_', '');
      return {
        replyToken: replyToken ?? '',
        messages: [
          {
            type: 'text',
            text: `✅ ขอบคุณที่สนใจสั่งซื้อสินค้า (รหัส: ${productId})\nเจ้าหน้าที่จะติดต่อกลับโดยเร็วที่สุด`,
          },
        ],
      };
    }

    if (postbackData === 'register') {
      return {
        replyToken: replyToken ?? '',
        messages: [
          {
            type: 'text',
            text: '📝 สมัครสมาชิกได้ที่ลิงก์นี้:\nhttps://project-nuclear-api.onrender.com/api/register\nหรือติดต่อเจ้าหน้าที่',
          },
        ],
      };
    }

    return null;
  }

  /**
   * Handle follow event (user adds the bot as friend)
   */
  async handleFollow(
    lineUserId: string | undefined,
    replyToken: string | undefined,
  ): Promise<messagingApi.ReplyMessageRequest | null> {
    this.logger.log(`👋 New follower: ${lineUserId}`);
    await this.logEvent(lineUserId ?? null, 'follow', {});

    return {
      replyToken: replyToken ?? '',
      messages: [
        {
          type: 'text',
          text: '🎉 ยินดีต้อนรับ! ขอบคุณที่เพิ่มเราเป็นเพื่อน\n\n📌 สามารถใช้เมนูด้านล่างเพื่อ:\n- ดูสินค้า\n- สมัครสมาชิก\n- ติดต่อเจ้าหน้าที่',
        },
      ],
    };
  }

  /**
   * Process a single LINE event and return a reply request
   */
  async processEvent(event: LineEventDto): Promise<messagingApi.ReplyMessageRequest | null> {
    const lineUserId = event.source?.userId;
    const eventType = event.type;

    // Log all events
    await this.logEvent(lineUserId ?? null, eventType, event as unknown as Record<string, unknown>);

    switch (eventType) {
      case 'postback':
        return this.handlePostback(
          lineUserId,
          event.replyToken,
          event.postback?.data ?? '',
          event.postback?.params,
        );

      case 'follow':
        return this.handleFollow(lineUserId, event.replyToken);

      case 'message':
        this.logger.log(`💬 Message event from ${lineUserId}: type=${event.message?.type}`);
        // Message events are handled by the controller directly
        return null;

      default:
        this.logger.log(`📋 Unhandled event type: ${eventType}`);
        return null;
    }
  }

  /**
   * Push a text message to a user via LINE Messaging API
   */
  async pushMessage(lineUserId: string, text: string): Promise<boolean> {
    if (!this.client) {
      this.logger.error(
        '❌ Cannot push message: LINE_ACCESS_TOKEN not configured',
      );
      return false;
    }

    try {
      await this.client.pushMessage({
        to: lineUserId,
        messages: [{ type: 'text', text }],
      });
      this.logger.log(`📤 Push message sent to ${lineUserId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Failed to push message to ${lineUserId}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Check if the LINE Messaging API client is available
   */
  get isClientAvailable(): boolean {
    return this.client !== null;
  }
}
