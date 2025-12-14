import { messagingConfig } from '../../config/messaging';
import { MessagingService } from './service';

export const messagingService = new MessagingService(messagingConfig);

export const sendSms = async (to: string, message: string) => {
  return messagingService.sendMessage({ to, message, type: 'sms' });
};

