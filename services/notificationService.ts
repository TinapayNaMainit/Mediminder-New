// services/notificationService.ts
// @ts-nocheck
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';

// Configure notification behavior
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

  // Request notification permissions
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
      Alert.alert(
        'Permission Required',
        'Please enable notifications to receive medication reminders'
      );
      return false;
    }

    // Configure notification channel for Android
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

  // Update notification settings
  updateSettings(settings: Partial<NotificationSettings>) {
    this.settings = { ...this.settings, ...settings };
  }

  // Check if currently in quiet hours
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

  // Schedule medication reminder (SCHEDULED ONLY - NO IMMEDIATE)
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
      console.log(`📅 Scheduling reminder for ${medicationName} at ${hour}:${minute}`);
      
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
          hour,
          minute,
          repeats: true,
        } as any,
      });

      console.log(`✅ Scheduled notification ${notificationId} for ${medicationName} at ${hour}:${minute}`);
      return notificationId;
    } catch (error) {
      console.error('❌ Error scheduling notification:', error);
      return null;
    }
  }

  // Snooze notification (10 minutes)
  async snoozeNotification(
    medicationId: string,
    medicationName: string,
    dosage: string,
    dosageUnit: string
  ): Promise<void> {
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
      },
      trigger: {
        seconds: snoozeSeconds,
      } as any,
    });

    console.log(`⏰ Medication snoozed for ${this.settings.snoozeMinutes} minutes`);
  }

  // Send immediate notification (ONLY for low stock alerts in Medicine Cabinet)
  async sendImmediateNotification(
    title: string,
    body: string,
    data?: any,
    urgent: boolean = false
  ): Promise<string> {
    // Only allow low_stock type notifications
    if (data?.type !== 'low_stock') {
      console.log('🔕 Immediate notification blocked (not low_stock):', title);
      return '';
    }

    if (this.isQuietHours() && !urgent) {
      console.log('🔕 Skipping notification during quiet hours');
      return '';
    }

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: this.settings.soundEnabled ? 'default' : undefined,
          priority: urgent
            ? Notifications.AndroidNotificationPriority.MAX
            : Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Immediate
      });

      console.log('📢 Immediate notification sent:', title);
      return notificationId;
    } catch (error) {
      console.error('❌ Error sending immediate notification:', error);
      return '';
    }
  }

  // Cancel specific notification
  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`🗑️ Cancelled notification: ${notificationId}`);
  }

  // Cancel all notifications for a medication
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

  // Cancel all notifications
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('🗑️ Cancelled all scheduled notifications');
  }

  // Get all scheduled notifications
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  // Set up notification action categories
  async setupNotificationCategories(): Promise<void> {
    await Notifications.setNotificationCategoryAsync('MEDICATION_REMINDER', [
      {
        identifier: 'TAKE_NOW',
        buttonTitle: '✅ Take Now',
        options: {
          opensAppToForeground: true,
        },
      } as any,
      {
        identifier: 'SNOOZE',
        buttonTitle: '⏰ Snooze 10 min',
        options: {
          opensAppToForeground: false,
        },
      } as any,
      {
        identifier: 'SKIP',
        buttonTitle: '❌ Skip',
        options: {
          opensAppToForeground: false,
          isDestructive: true,
        },
      } as any,
    ]);

    await Notifications.setNotificationCategoryAsync('URGENT_REMINDER', [
      {
        identifier: 'TAKE_NOW',
        buttonTitle: '✅ Take Now',
        options: {
          opensAppToForeground: true,
        },
      } as any,
      {
        identifier: 'DISMISS',
        buttonTitle: 'Dismiss',
        options: {
          opensAppToForeground: false,
        },
      } as any,
    ]);

    console.log('✅ Notification categories set up');
  }

  // Handle notification response (when user taps action button)
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

// Helper function to format time
export const formatTimeForNotification = (hour: number, minute: number): string => {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
};