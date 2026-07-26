export class LineWebhookEventDto {
  destination: string;
  events: LineEventDto[];
}

export class LineEventDto {
  type: string;
  mode?: string;
  timestamp?: number;
  source?: {
    userId?: string;
    groupId?: string;
    roomId?: string;
    type?: string;
  };
  replyToken?: string;
  webhookEventId?: string;
  deliveryContext?: {
    isRedelivery: boolean;
  };
  postback?: {
    data: string;
    params?: Record<string, string>;
  };
  message?: {
    id: string;
    type: string;
    text?: string;
    [key: string]: unknown;
  };
  follow?: Record<string, unknown>;
  [key: string]: unknown;
}
