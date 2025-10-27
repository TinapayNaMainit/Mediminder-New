// services/notificationService.ts - PROPERLY FIXED with Correct Trigger Types
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  snoozeMinutes: number;
}

class NotificationService {
  private settings: NotificationSettings = {
    soundEnabled: true,
    vibrationEnabled: true,
    snoozeMinutes: 10,
  };

  async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.warn('⚠️ Notifications only work on physical devices');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('⚠️ Notification permissions denied');
      return false;
    }

    if (Platform.OS === 'android') {
      await this.setupAndroidChannel();
    }

    return true;
  }

  private async setupAndroidChannel(): Promise<void> {
    try {
      await Notifications.deleteNotificationChannelAsync('medication-reminders').catch(() => {});
      
      await Notifications.setNotificationChannelAsync('medication-reminders', {
        name: 'Medication Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        sound: 'default',
        lightColor: '#6366F1',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
      });

      console.log('✅ Android notification channel created');
    } catch (error) {
      console.error('❌ Error setting up Android channel:', error);
    }
  }

  updateSettings(settings: Partial<NotificationSettings>) {
    this.settings = { ...this.settings, ...settings };
  }

  // ✅ FIXED: Proper DailyTriggerInput with type property
  async scheduleMedicationReminder(
    medicationId: string,
    medicationName: string,
    dosage: string,
    dosageUnit: string,
    hour: number,
    minute: number,
    notes?: string
  ): Promise<string | null> {
    try {
      await this.cancelMedicationNotifications(medicationId);

      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        throw new Error('Invalid time');
      }

      console.log(`🔔 Scheduling notification for ${medicationName} at ${hour}:${minute}`);

      const content: Notifications.NotificationContentInput = {
        title: '💊 Time for your medication',
        body: `${medicationName} - ${dosage}${dosageUnit}${notes ? `\n${notes}` : ''}`,
        data: {
          medicationId,
          medicationName,
          dosage,
          dosageUnit,
          notes,
          type: 'daily_reminder',
        },
        sound: this.settings.soundEnabled ? 'default' : undefined,
        badge: 1,
        priority: Notifications.AndroidNotificationPriority.MAX,
        categoryIdentifier: 'MEDICATION_REMINDER',
        vibrate: this.settings.vibrationEnabled ? [0, 250, 250, 250] : undefined,
      };

      // ✅ CRITICAL FIX: Proper trigger without 'repeats' for ChannelAwareTriggerInput
      const trigger: Notifications.NotificationTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        channelId: 'medication-reminders',
        hour,
        minute,
      };

      const notificationId = await Notifications.scheduleNotificationAsync({
        content,
        trigger,
      });

      if (!notificationId) {
        throw new Error('Failed to schedule notification');
      }

      // Verify notification was scheduled
      await new Promise(resolve => setTimeout(resolve, 500));
      const all = await Notifications.getAllScheduledNotificationsAsync();
      const found = all.find(n => n.identifier === notificationId);
      
      if (!found) {
        throw new Error('Notification not found after scheduling');
      }

      console.log(`✅ Notification scheduled: ${notificationId}`);
      return notificationId;
    } catch (error: any) {
      console.error('❌ Scheduling failed:', error);
      throw new Error(`Scheduling failed: ${error.message}`);
    }
  }

  // ✅ FIXED: Proper TimeIntervalTriggerInput with type property
  async snoozeNotification(
    medicationId: string,
    medicationName: string,
    dosage: string,
    dosageUnit: string
  ): Promise<void> {
    try {
      console.log(`⏰ Snoozing ${medicationName} for ${this.settings.snoozeMinutes} minutes`);

      const content: Notifications.NotificationContentInput = {
        title: '⏰ Snoozed Reminder',
        body: `${medicationName} - ${dosage}${dosageUnit}\nRemember to take your medication!`,
        data: { 
          medicationId, 
          medicationName,
          dosage,
          dosageUnit,
          type: 'snoozed' 
        },
        sound: this.settings.soundEnabled ? 'default' : undefined,
        badge: 1,
        priority: Notifications.AndroidNotificationPriority.MAX,
        categoryIdentifier: 'MEDICATION_REMINDER',
        vibrate: this.settings.vibrationEnabled ? [0, 250, 250, 250] : undefined,
      };

      // ✅ CRITICAL FIX: Time interval trigger without repeats
      const trigger: Notifications.NotificationTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        channelId: 'medication-reminders',
        seconds: this.settings.snoozeMinutes * 60,
      };

      await Notifications.scheduleNotificationAsync({
        content,
        trigger,
      });

      console.log(`✅ Snoozed for ${this.settings.snoozeMinutes} minutes`);
    } catch (error) {
      console.error('❌ Error snoozing notification:', error);
    }
  }

  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log(`✅ Cancelled notification: ${notificationId}`);
    } catch (error) {
      console.error('❌ Error cancelling notification:', error);
    }
  }

  async cancelMedicationNotifications(medicationId: string): Promise<void> {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const toCancel = scheduled.filter(n => n.content.data?.medicationId === medicationId);

      console.log(`🗑️ Cancelling ${toCancel.length} notifications for medication ${medicationId}`);

      for (const notification of toCancel) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    } catch (error) {
      console.error('❌ Error cancelling medication notifications:', error);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('✅ All notifications cancelled');
    } catch (error) {
      console.error('❌ Error cancelling all notifications:', error);
    }
  }

  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  async setupNotificationCategories(): Promise<void> {
    try {
      await Notifications.setNotificationCategoryAsync('MEDICATION_REMINDER', [
        {
          identifier: 'TAKE_NOW',
          buttonTitle: '✅ Take Now',
          options: { 
            opensAppToForeground: true,
            isAuthenticationRequired: false,
          },
        },
        {
          identifier: 'SNOOZE',
          buttonTitle: '⏰ Snooze 10min',
          options: { 
            opensAppToForeground: false,
            isAuthenticationRequired: false,
          },
        },
        {
          identifier: 'SKIP',
          buttonTitle: '❌ Skip',
          options: { 
            opensAppToForeground: false,
            isDestructive: true,
            isAuthenticationRequired: false,
          },
        },
      ]);

      console.log('✅ Notification categories set up');
    } catch (error) {
      console.error('❌ Error setting up categories:', error);
    }
  }

  setupNotificationResponseHandler(
    onTakeNow: (medicationId: string) => Promise<void>,
    onSnooze: (medicationId: string) => Promise<void>,
    onSkip: (medicationId: string) => Promise<void>
  ): void {
    Notifications.addNotificationResponseReceivedListener(async (response) => {
      try {
        const medicationId = response.notification.request.content.data?.medicationId as string;
        const medicationName = response.notification.request.content.data?.medicationName as string;
        const dosage = response.notification.request.content.data?.dosage as string;
        const dosageUnit = response.notification.request.content.data?.dosageUnit as string;

        if (!medicationId) {
          console.warn('⚠️ No medication ID in notification data');
          return;
        }

        console.log('📱 Notification action:', response.actionIdentifier, 'for', medicationName);

        switch (response.actionIdentifier) {
          case 'TAKE_NOW':
            await onTakeNow(medicationId);
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '✅ Medication Taken',
                body: `${medicationName} logged successfully!`,
                sound: 'default',
              },
              trigger: null,
            });
            break;

          case 'SNOOZE':
            await onSnooze(medicationId);
            await this.snoozeNotification(medicationId, medicationName, dosage, dosageUnit);
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '⏰ Reminder Snoozed',
                body: `${medicationName} reminder in ${this.settings.snoozeMinutes} minutes`,
                sound: 'default',
              },
              trigger: null,
            });
            break;

          case 'SKIP':
            await onSkip(medicationId);
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '⏭️ Medication Skipped',
                body: `${medicationName} marked as skipped`,
                sound: 'default',
              },
              trigger: null,
            });
            break;

          default:
            console.log('📱 Notification tapped, opening app');
            break;
        }
      } catch (error) {
        console.error('❌ Error handling notification response:', error);
      }
    });

    console.log('✅ Notification response handler set up');
  }

  // ✅ FIXED: Test notification with proper trigger (no repeats)
  async sendTestNotification(medicationName: string): Promise<void> {
    try {
      const trigger: Notifications.NotificationTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        channelId: 'medication-reminders',
        seconds: 2,
      };

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💊 Test Medication Reminder',
          body: `${medicationName} - This is a test notification`,
          sound: 'default',
          badge: 1,
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryIdentifier: 'MEDICATION_REMINDER',
          vibrate: [0, 250, 250, 250],
        },
        trigger,
      });
      console.log('✅ Test notification scheduled');
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
    }
  }
}

export const notificationService = new NotificationService();