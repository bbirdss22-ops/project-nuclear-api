import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { LineBotClient, messagingApi } from '@line/bot-sdk';
import type { LineEventDto } from './dto/line-webhook.dto.js';

@Injectable()
export class LineService {
  private readonly logger = new Logger(LineService.name);
  private client: LineBotClient | null = null;
  readonly frontendUrl: string = 'https://project-nuclear-web.vercel.app';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || this.frontendUrl;
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

    // Normalize: strip "action=" prefix if present
    const action = postbackData.startsWith('action=')
      ? postbackData.slice(7)
      : postbackData;

    if (action === 'register') {
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.prisma.registrationToken.create({
        data: {
          id: token,
          lineUserId: lineUserId ?? '',
          expiresAt,
        },
      });

      const registerUrl = `https://project-nuclear-web.vercel.app/register?token=${token}`;

      return {
        replyToken: replyToken ?? '',
        messages: [
          {
            type: 'text',
            text: `📝 กรุณากดลิงก์นี้เพื่อสมัครสมาชิก (ลิงก์หมดอายุใน 1 ชั่วโมง):\n${registerUrl}`,
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
        return this.handleMessage(lineUserId, event.replyToken, event.message);

      default:
        this.logger.log(`📋 Unhandled event type: ${eventType}`);
        return null;
    }
  }

  /**
   * Push the post-registration welcome message (activity image if configured,
   * followed by the customer code text). Reads ACTIVITY_IMAGE_URL from env;
   * when not set, only the text message is pushed.
   */
  async pushWelcome(lineUserId: string, code: string): Promise<boolean> {
    const text = `🎉 สมัครสมาชิกสำเร็จ!\n🆔 รหัสลูกค้าของคุณคือ: ${code}\n\n📌 ใช้รหัสนี้แจ้งเจ้าหน้าที่เวลาสอบถามหรือสั่งซื้อสินค้า`;
    const imageUrl = this.configService.get<string>('ACTIVITY_IMAGE_URL');
    return this.pushMessage(lineUserId, text, imageUrl);
  }

  /**
   * Push a text message to a user via LINE Messaging API.
   * Optionally prepends an image message (e.g. activity photo) when imageUrl is provided.
   */
  async pushMessage(
    lineUserId: string,
    text: string,
    imageUrl?: string,
  ): Promise<boolean> {
    if (!this.client) {
      this.logger.error(
        '❌ Cannot push message: LINE_ACCESS_TOKEN not configured',
      );
      return false;
    }

    try {
      const messages: messagingApi.Message[] = [];
      const original = imageUrl?.trim();
      if (original) {
        const preview =
          this.configService
            .get<string>('ACTIVITY_IMAGE_PREVIEW_URL')
            ?.trim() || original;
        messages.push({
          type: 'image',
          originalContentUrl: original,
          previewImageUrl: preview,
        });
      }
      messages.push({ type: 'text', text });

      await this.client.pushMessage({ to: lineUserId, messages });
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
   * Handle text message events
   */
  async handleMessage(
    lineUserId: string | undefined,
    replyToken: string | undefined,
    message: { id: string; type: string; text?: string; [key: string]: unknown } | undefined,
  ): Promise<messagingApi.ReplyMessageRequest | null> {
    if (!message || message.type !== 'text' || !replyToken) {
      return null;
    }

    const text = message.text ?? '';
    this.logger.log(`💬 Text from ${lineUserId}: "${text.substring(0, 100)}"`);

    // Text commands removed — all text messages are silently ignored.
    return null;
  }

  /**
   * Reply to a user via reply token (uses reply API)
   */
  async replyMessage(request: messagingApi.ReplyMessageRequest): Promise<boolean> {
    if (!this.client) {
      this.logger.error('❌ Cannot reply: LINE_ACCESS_TOKEN not configured');
      return false;
    }

    if (!request.replyToken) {
      this.logger.warn('⚠️ Cannot reply: replyToken is empty');
      return false;
    }

    try {
      await this.client.replyMessage(request);
      this.logger.log(`📤 Reply sent (replyToken: ${request.replyToken.substring(0, 8)}…)`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to reply: ${(error as Error).message}`);
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
