// services/notificationService.ts - PROPERLY TYPED
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Properly typed notification handler with cast
Notifications.setNotificationHandler({
  handleNotification: async () => {
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    } as Notifications.NotificationBehavior;
  },
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
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
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
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
        lightColor: '#6366F1',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
      });
    } catch (error) {
      // Silent fail
    }
  }

  updateSettings(settings: Partial<NotificationSettings>) {
    this.settings = { ...this.settings, ...settings };
  }

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
        sound: 'default',
        badge: 1,
        categoryIdentifier: 'MEDICATION_REMINDER',
      };

      const trigger: Notifications.NotificationTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        repeats: true,
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

      await new Promise(resolve => setTimeout(resolve, 500));
      const all = await Notifications.getAllScheduledNotificationsAsync();
      const found = all.find(n => n.identifier === notificationId);
      
      if (!found) {
        throw new Error('Notification not found after scheduling');
      }

      return notificationId;
    } catch (error: any) {
      throw new Error(`Scheduling failed: ${error.message}`);
    }
  }

  async snoozeNotification(
    medicationId: string,
    medicationName: string,
    dosage: string,
    dosageUnit: string
  ): Promise<void> {
    const content: Notifications.NotificationContentInput = {
      title: '💊 Snoozed Reminder',
      body: `${medicationName} - ${dosage}${dosageUnit}`,
      data: { medicationId, type: 'snoozed' },
      sound: 'default',
      badge: 1,
    };

    const trigger: Notifications.NotificationTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      repeats: false,
      seconds: this.settings.snoozeMinutes * 60,
    };

    await Notifications.scheduleNotificationAsync({
      content,
      trigger,
    });
  }

  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  async cancelMedicationNotifications(medicationId: string): Promise<void> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = scheduled.filter(n => n.content.data?.medicationId === medicationId);

    for (const notification of toCancel) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  async setupNotificationCategories(): Promise<void> {
    await Notifications.setNotificationCategoryAsync('MEDICATION_REMINDER', [
      {
        identifier: 'TAKE_NOW',
        buttonTitle: '✅ Take Now',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'SNOOZE',
        buttonTitle: '⏰ Snooze',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'SKIP',
        buttonTitle: '❌ Skip',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ]);
  }

  setupNotificationResponseHandler(
    onTakeNow: (medicationId: string) => void,
    onSnooze: (medicationId: string) => void,
    onSkip: (medicationId: string) => void
  ): void {
    Notifications.addNotificationResponseReceivedListener((response) => {
      const medicationId = response.notification.request.content.data?.medicationId as string;
      if (!medicationId) return;

      switch (response.actionIdentifier) {
        case 'TAKE_NOW': onTakeNow(medicationId); break;
        case 'SNOOZE': onSnooze(medicationId); break;
        case 'SKIP': onSkip(medicationId); break;
      }
    });
  }
}

export const notificationService = new NotificationService();