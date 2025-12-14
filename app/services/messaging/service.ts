import { SMS4FreeProvider } from './providers/sms4freeProvider';
import { WhatsAppProvider } from './providers/whatsappProvider';
import { MessageProvider, MessagingConfig, SendMessageParams, SendMessageResult } from './types';

export class MessagingService {
  private providers: Map<string, MessageProvider> = new Map();
  private config: MessagingConfig;

  constructor(config: MessagingConfig) {
    this.config = config;
    this.initializeProviders();
  }

  private initializeProviders() {
    if ((this.config as any).providers.sms4free) {
      const cfg = (this.config as any).providers.sms4free as any;
      this.providers.set('sms4free', new SMS4FreeProvider(cfg));
    }

    if (this.config.providers.whatsapp) {
      const whatsappProvider = new WhatsAppProvider(this.config.providers.whatsapp);
      this.providers.set('whatsapp', whatsappProvider);
    }
  }

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const primaryProvider = this.providers.get(this.config.defaultProvider);
    if (!primaryProvider) {
      throw new Error(`Default provider '${this.config.defaultProvider}' not available`);
    }

    try {
      return await primaryProvider.send(params);
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'unknown',
        provider: this.config.defaultProvider,
      };
    }
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.entries())
      .filter(([_, provider]) => provider.isAvailable())
      .map(([name]) => name);
  }

  updateConfig(newConfig: Partial<MessagingConfig>) {
    this.config = { ...this.config, ...newConfig } as MessagingConfig;
    this.providers.clear();
    this.initializeProviders();
  }
}

