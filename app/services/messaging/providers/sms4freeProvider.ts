import { MessageProvider, SendMessageParams, SendMessageResult } from '../types';

export class SMS4FreeProvider implements MessageProvider {
  name = 'sms4free';
  private apiKey: string;
  private user: string;
  private pass: string;
  private sender: string;
  private enabled: boolean;
  private endpoint = 'https://api.sms4free.co.il/ApiSMS/v2/SendSMS';

  constructor(cfg: { apiKey: string; user: string; pass: string; sender: string; enabled: boolean }) {
    // Use exact credentials from config (no fallback - must be provided)
    this.apiKey = cfg.apiKey || 'mgfwkoRBI';
    // User should be in Israeli format (05xxxxxxxx) - MUST use from config, no fallback
    this.user = cfg.user;  // Connection number - MUST be provided from config
    this.pass = cfg.pass || '73960779';
    this.sender = cfg.sender || 'ToriX';  // Sender name
    this.enabled = cfg.enabled;
    
    // Log to verify correct credentials are being used
    console.log(`📱 אילון מתוק SMS Provider initialized with:`);
    console.log(`   user: ${this.user}`);
    console.log(`   sender: ${this.sender}`);
    console.log(`   apiKey: ${this.apiKey ? '***' + this.apiKey.slice(-4) : 'missing'}`);
  }

  isAvailable(): boolean {
    return this.enabled && !!this.apiKey && !!this.user && !!this.pass && !!this.sender;
  }

  async send(params: SendMessageParams): Promise<SendMessageResult> {
    if (!this.isAvailable()) {
      return { success: false, error: 'SMS4FREE not available', provider: this.name };
    }

    // Convert recipient to Israeli local format (05xxxxxxxx)
    let recipient = params.to;
    if (recipient.startsWith('+972')) {
      recipient = '0' + recipient.substring(4);
    }
    
    // Ensure message is short (<70 characters in Hebrew) to avoid splitting
    const message = params.message.length > 70 ? params.message.substring(0, 67) + '...' : params.message;
    
    // Use ONLY the user from config - don't try multiple formats
    // The API expects the exact format as registered in SMS4Free panel
    try {
      const body = {
        key: this.apiKey,
        user: this.user,  // Use exactly as configured: 0523985505
        pass: this.pass,
        sender: this.sender,
        recipient: recipient,  // Israeli format: 05xxxxxxxx
        msg: message,
      };

      console.log(`📱 אילון מתוק SMS: שולח עם user=${this.user} (מהקונפיג)`);
      console.log(`📱 Request body:`, JSON.stringify(body, null, 2));

      const resp = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(body),
      });

      console.log(`📱 Response status: ${resp.status}`);
      
      const responseText = await resp.text();
      console.log(`📱 Response body:`, responseText);

      if (!resp.ok) {
        console.error(`❌ HTTP Error ${resp.status}: ${responseText}`);
        throw new Error(`HTTP ${resp.status}: ${responseText}`);
      }
      
      const out = JSON.parse(responseText); // {status:number, message:string}

      console.log('📱 אילון מתוק SMS Response:', out);

      if (typeof out?.status === 'number' && out.status > 0) {
        return { success: true, messageId: String(out.status), provider: this.name };
      }
      
      return { success: false, error: `${out?.status} - ${out?.message || 'unknown'}`, provider: this.name };
    } catch (e: any) {
      console.error('📱 אילון מתוק SMS Error:', e);
      return { success: false, error: e.message, provider: this.name };
    }
  }
}