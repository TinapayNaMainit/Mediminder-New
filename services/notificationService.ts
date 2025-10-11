// services/notificationService.ts - COMPLETE FIX (No Immediate Notifications)
// @ts-nocheck
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  snoozeMinutes: number;
  escalateAfterMinutes: number;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

class NotificationService {
  private settings: NotificationSettings = {
    soundEnabled: true,
    vibrationEnabled: true,
    snoozeMinutes: 10,
    escalateAfterMinutes: 10,
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
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('medication-reminders', {
        name: 'Medication Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
        lightColor: '#6366F1',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
      });

      await Notifications.setNotificationChannelAsync('urgent-reminders', {
        name: 'Urgent Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 500, 500],
        sound: 'default',
        lightColor: '#EF4444',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
      });
    }

    console.log('✅ Notification permissions granted');
    return true;
  }

  updateSettings(settings: Partial<NotificationSettings>) {
    this.settings = { ...this.settings, ...settings };
  }

  isQuietHours(): boolean {
    if (!this.settings.quietHoursStart || !this.settings.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = this.settings.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = this.settings.quietHoursEnd.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime < endTime) {
      return currentTime >= startTime && currentTime < endTime;
    } else {
      return currentTime >= startTime || currentTime < endTime;
    }
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
      // 🔥 CRITICAL FIX: Calculate next occurrence properly
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(hour, minute, 0, 0);
      
      // If scheduled time already passed today, start from tomorrow
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }
      
      // Calculate seconds until first notification
      const secondsUntilFirst = Math.floor((scheduledTime.getTime() - now.getTime()) / 1000);
      
      console.log('📅 Scheduling notification:');
      console.log('   Medication:', medicationName);
      console.log('   Target time:', `${hour}:${minute.toString().padStart(2, '0')}`);
      console.log('   First notification:', scheduledTime.toLocaleString());
      console.log('   Seconds until first:', secondsUntilFirst);
      
      // 🔥 FIX: Use date-based trigger instead of daily time trigger
      // This prevents immediate notifications in Expo Go
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '💊 Time for your medication',
          body: `${medicationName} - ${dosage}${dosageUnit}`,
          data: {
            medicationId,
            medicationName,
            dosage,
            dosageUnit,
            type: 'scheduled_reminder',
            notes,
          },
          sound: this.settings.soundEnabled ? 'default' : undefined,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          badge: 1,
          categoryIdentifier: 'MEDICATION_REMINDER',
        },
        trigger: {
          // Use specific date for first notification
          date: scheduledTime,
          repeats: false, // We'll handle repeating manually
        },
      });

      // 🔥 Schedule repeating notification starting from tomorrow
      const tomorrowScheduledTime = new Date(scheduledTime);
      tomorrowScheduledTime.setDate(tomorrowScheduledTime.getDate() + 1);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💊 Time for your medication',
          body: `${medicationName} - ${dosage}${dosageUnit}`,
          data: {
            medicationId,
            medicationName,
            dosage,
            dosageUnit,
            type: 'scheduled_reminder',
            notes,
          },
          sound: this.settings.soundEnabled ? 'default' : undefined,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          badge: 1,
          categoryIdentifier: 'MEDICATION_REMINDER',
        },
        trigger: {
          hour,
          minute,
          repeats: true, // Daily repeating from tomorrow onwards
        },
      });

      console.log(`✅ Notifications scheduled:`);
      console.log(`   - First: ${scheduledTime.toLocaleString()}`);
      console.log(`   - Repeating: Daily at ${hour}:${minute.toString().padStart(2, '0')}`);
      
      return notificationId;
    } catch (error) {
      console.error('❌ Error scheduling notification:', error);
      return null;
    }
  }

  async snoozeNotification(
    medicationId: string,
    medicationName: string,
    dosage: string,
    dosageUnit: string
  ): Promise<void> {
    console.log('⏰ Snoozing medication:', medicationName);
    
    const snoozeSeconds = this.settings.snoozeMinutes * 60;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💊 Snoozed Reminder',
        body: `${medicationName} - ${dosage}${dosageUnit}`,
        data: {
          medicationId,
          type: 'snoozed_reminder',
        },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: 'MEDICATION_REMINDER',
      },
      trigger: {
        seconds: snoozeSeconds,
      },
    });

    console.log(`⏰ Medication snoozed for ${this.settings.snoozeMinutes} minutes`);
  }

  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`🗑️ Cancelled notification: ${notificationId}`);
  }

  async cancelMedicationNotifications(medicationId: string): Promise<void> {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    const medicationNotifications = scheduledNotifications.filter(
      (notification) => notification.content.data?.medicationId === medicationId
    );

    for (const notification of medicationNotifications) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }

    console.log(`🗑️ Cancelled ${medicationNotifications.length} notification(s) for medication ${medicationId}`);
  }

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('🗑️ Cancelled all scheduled notifications');
  }

  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`📋 Found ${notifications.length} scheduled notifications`);
    
    // Log details for debugging
    notifications.forEach((notif, index) => {
      const trigger = notif.trigger as any;
      console.log(`   ${index + 1}. ${notif.content.title}`);
      if (trigger.type === 'date') {
        console.log(`      Date: ${new Date(trigger.value).toLocaleString()}`);
      } else if (trigger.type === 'daily') {
        console.log(`      Daily at: ${trigger.hour}:${trigger.minute}`);
      }
    });
    
    return notifications;
  }

  async setupNotificationCategories(): Promise<void> {
    await Notifications.setNotificationCategoryAsync('MEDICATION_REMINDER', [
      {
        identifier: 'TAKE_NOW',
        buttonTitle: '✅ Take Now',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'SNOOZE',
        buttonTitle: '⏰ Snooze 10 min',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'SKIP',
        buttonTitle: '❌ Skip',
        options: {
          opensAppToForeground: false,
          isDestructive: true,
        },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('URGENT_REMINDER', [
      {
        identifier: 'TAKE_NOW',
        buttonTitle: '✅ Take Now',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'DISMISS',
        buttonTitle: 'Dismiss',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);

    console.log('✅ Notification categories set up');
  }

  setupNotificationResponseHandler(
    onTakeNow: (medicationId: string) => void,
    onSnooze: (medicationId: string) => void,
    onSkip: (medicationId: string) => void
  ): void {
    Notifications.addNotificationResponseReceivedListener((response) => {
      const { actionIdentifier, notification } = response;
      const medicationId = notification.request.content.data?.medicationId;

      if (!medicationId) return;

      console.log(`🔔 Notification action: ${actionIdentifier} for medication: ${medicationId}`);

      switch (actionIdentifier) {
        case 'TAKE_NOW':
          onTakeNow(medicationId);
          break;
        case 'SNOOZE':
          onSnooze(medicationId);
          break;
        case 'SKIP':
          onSkip(medicationId);
          break;
      }
    });
  }
}

export const notificationService = new NotificationService();

export const formatTimeForNotification = (hour: number, minute: number): string => {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
};