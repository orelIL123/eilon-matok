import { MessageProvider, SendMessageParams, SendMessageResult } from '../types';

export class WhatsAppProvider implements MessageProvider {
  name = 'whatsapp';
  private phoneNumberId: string;
  private accessToken: string;
  private enabled: boolean;

  constructor(cfg: { phoneNumberId: string; accessToken: string; enabled: boolean }) {
    this.phoneNumberId = cfg.phoneNumberId;
    this.accessToken = cfg.accessToken;
    this.enabled = cfg.enabled;
  }

  isAvailable(): boolean {
    return this.enabled && !!this.phoneNumberId && !!this.accessToken;
  }

  async send(params: SendMessageParams): Promise<SendMessageResult> {
    return { success: false, error: 'WhatsApp not configured', provider: this.name };
  }
}

