// services/notificationService.ts - FIXED with Frequency Support
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

// ✅ NEW: Frequency configuration
interface FrequencyConfig {
  interval: number; // hours between doses
  timesPerDay: number;
}

class NotificationService {
  private settings: NotificationSettings = {
    soundEnabled: true,
    vibrationEnabled: true,
    snoozeMinutes: 10,
  };

  // ✅ NEW: Parse frequency to get schedule configuration
  private getFrequencyConfig(frequency: string): FrequencyConfig {
    const configs: { [key: string]: FrequencyConfig } = {
      'Once daily': { interval: 24, timesPerDay: 1 },
      'Twice daily': { interval: 12, timesPerDay: 2 },
      'Three times daily': { interval: 8, timesPerDay: 3 },
      'Four times daily': { interval: 6, timesPerDay: 4 },
      'Every 4 hours': { interval: 4, timesPerDay: 6 },
      'Every 6 hours': { interval: 6, timesPerDay: 4 },
      'Every 8 hours': { interval: 8, timesPerDay: 3 },
      'Every 12 hours': { interval: 12, timesPerDay: 2 },
      'Before meals': { interval: 0, timesPerDay: 3 },
      'After meals': { interval: 0, timesPerDay: 3 },
      'Bedtime': { interval: 24, timesPerDay: 1 },
      'As needed': { interval: 0, timesPerDay: 0 },
      'Weekly': { interval: 168, timesPerDay: 0 },
    };
    return configs[frequency] || { interval: 24, timesPerDay: 1 };
  }

  // ✅ NEW: Calculate all notification times for the day
  private calculateNotificationTimes(
    startHour: number,
    startMinute: number,
    frequency: string
  ): Array<{ hour: number; minute: number }> {
    const config = this.getFrequencyConfig(frequency);
    const times: Array<{ hour: number; minute: number }> = [];

    if (config.timesPerDay === 0) {
      // As needed or special cases - only one notification
      return [{ hour: startHour, minute: startMinute }];
    }

    if (config.timesPerDay === 1) {
      // Once daily
      return [{ hour: startHour, minute: startMinute }];
    }

    // Calculate multiple times based on interval
    for (let i = 0; i < config.timesPerDay; i++) {
      const totalMinutes = startHour * 60 + startMinute + (i * config.interval * 60);
      const hour = Math.floor(totalMinutes / 60) % 24;
      const minute = totalMinutes % 60;
      times.push({ hour, minute });
    }

    return times;
  }

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

  // ✅ UPDATED: Now accepts frequency parameter (8th parameter)
  async scheduleMedicationReminder(
    medicationId: string,
    medicationName: string,
    dosage: string,
    dosageUnit: string,
    hour: number,
    minute: number,
    notes?: string,
    frequency?: string  // ✅ NEW: Added frequency parameter
  ): Promise<string | null> {
    try {
      await this.cancelMedicationNotifications(medicationId);

      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        throw new Error('Invalid time');
      }

      // ✅ Calculate all notification times based on frequency
      const notificationTimes = this.calculateNotificationTimes(
        hour,
        minute,
        frequency || 'Once daily'
      );

      console.log(`🔔 Scheduling ${notificationTimes.length} notification(s) for ${medicationName}`);
      console.log('   Times:', notificationTimes.map(t => `${t.hour}:${String(t.minute).padStart(2, '0')}`).join(', '));

      const notificationIds: string[] = [];

      // ✅ Schedule notification for each time
      for (let i = 0; i < notificationTimes.length; i++) {
        const time = notificationTimes[i];

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
            reminderIndex: i,
            totalReminders: notificationTimes.length,
          },
          sound: this.settings.soundEnabled ? 'default' : undefined,
          badge: 1,
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryIdentifier: 'MEDICATION_REMINDER',
          vibrate: this.settings.vibrationEnabled ? [0, 250, 250, 250] : undefined,
        };

        const trigger: Notifications.NotificationTriggerInput = {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          channelId: 'medication-reminders',
          hour: time.hour,
          minute: time.minute,
        };

        const notificationId = await Notifications.scheduleNotificationAsync({
          content,
          trigger,
        });

        if (notificationId) {
          notificationIds.push(notificationId);
          console.log(`   ✅ Scheduled notification ${i + 1}/${notificationTimes.length} at ${time.hour}:${String(time.minute).padStart(2, '0')}`);
        }
      }

      // Verify notifications were scheduled
      await new Promise(resolve => setTimeout(resolve, 500));
      const all = await Notifications.getAllScheduledNotificationsAsync();
      const scheduled = all.filter(n => n.content.data?.medicationId === medicationId);
      
      console.log(`✅ Total scheduled: ${scheduled.length}/${notificationTimes.length}`);

      // Return the first notification ID as reference
      return notificationIds[0] || null;
    } catch (error: any) {
      console.error('❌ Scheduling failed:', error);
      throw new Error(`Scheduling failed: ${error.message}`);
    }
  }

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

      console.log(`✅ Cancelled all notifications for ${medicationId}`);
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

  // ✅ NEW: Get scheduled notifications for specific medication
  async getMedicationNotifications(medicationId: string): Promise<Array<{ hour: number; minute: number }>> {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const medicationNotifs = scheduled.filter(n => n.content.data?.medicationId === medicationId);

      const times = medicationNotifs.map(n => {
        const trigger = n.trigger as any;
        if (trigger.hour !== undefined && trigger.minute !== undefined) {
          return { hour: trigger.hour, minute: trigger.minute };
        }
        return null;
      }).filter(t => t !== null) as Array<{ hour: number; minute: number }>;

      return times.sort((a, b) => {
        const aMinutes = a.hour * 60 + a.minute;
        const bMinutes = b.hour * 60 + b.minute;
        return aMinutes - bMinutes;
      });
    } catch (error) {
      console.error('Error getting medication notifications:', error);
      return [];
    }
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
        const reminderIndex = response.notification.request.content.data?.reminderIndex as number;
        const totalReminders = response.notification.request.content.data?.totalReminders as number;

        if (!medicationId) {
          console.warn('⚠️ No medication ID in notification data');
          return;
        }

        const reminderInfo = totalReminders > 1 
          ? ` (Dose ${reminderIndex + 1}/${totalReminders})` 
          : '';

        console.log('📱 Notification action:', response.actionIdentifier, 'for', medicationName + reminderInfo);

        switch (response.actionIdentifier) {
          case 'TAKE_NOW':
            await onTakeNow(medicationId);
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '✅ Medication Taken',
                body: `${medicationName}${reminderInfo} logged successfully!`,
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
                body: `${medicationName}${reminderInfo} reminder in ${this.settings.snoozeMinutes} minutes`,
                sound: 'default',
              },
              trigger: null,
            });
            break;

          case 'SKIP':
            await onSkip(medicationId);
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '⭕️ Medication Skipped',
                body: `${medicationName}${reminderInfo} marked as skipped`,
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