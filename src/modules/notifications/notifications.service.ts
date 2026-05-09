import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly apiUrl = 'https://app.nativenotify.com/api/indie/notification';

  constructor(private readonly httpService: HttpService) {}

  /**
   * Sends an Indie Push Notification to a specific user via Native Notify.
   * The subID is ideally the user's Supabase providerId (UUID).
   */
  async sendPushNotification(subID: string, title: string, message: string, pushData?: Record<string, any>) {
    const appId = process.env.NATIVE_NOTIFY_APP_ID;
    const appToken = process.env.NATIVE_NOTIFY_APP_TOKEN;

    if (!appId || !appToken) {
      this.logger.warn('Native Notify App ID or Token is missing in .env. Skipping push notification.');
      return;
    }

    try {
      const payload = {
        subID: subID,
        appId: Number(appId),
        appToken: appToken,
        title: title,
        message: message,
        pushData: pushData || {},
      };

      const response = await firstValueFrom(
        this.httpService.post(this.apiUrl, payload),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to send push notification to ${subID}`, error.response?.data || error.message);
      // We don't throw an error here to prevent the main request (like sending a chat) from failing
    }
  }
}
