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
  quietHoursStart?: string; // "22:00"
  quietHoursEnd?: string; // "07:00"
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
      Alert.alert('Error', 'Notifications only work on physical devices');
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
      // Quiet hours cross midnight
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  // Schedule initial medication reminder
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
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '💊 Time for your medication',
          body: `${medicationName} - ${dosage}${dosageUnit}`,
          data: {
            medicationId,
            medicationName,
            dosage,
            dosageUnit,
            type: 'initial_reminder',
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

      console.log(`Scheduled notification ${notificationId} for ${medicationName}`);

      // Schedule escalated reminder
      await this.scheduleEscalatedReminder(
        medicationId,
        medicationName,
        dosage,
        dosageUnit,
        hour,
        minute
      );

      return notificationId;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  // Schedule escalated reminder (louder, more persistent)
  private async scheduleEscalatedReminder(
    medicationId: string,
    medicationName: string,
    dosage: string,
    dosageUnit: string,
    originalHour: number,
    originalMinute: number
  ): Promise<string | null> {
    try {
      // Calculate escalation time
      const escalationMinutes = originalMinute + this.settings.escalateAfterMinutes;
      let escalationHour = originalHour;
      let escalationMinute = escalationMinutes;

      if (escalationMinutes >= 60) {
        escalationHour = (originalHour + 1) % 24;
        escalationMinute = escalationMinutes - 60;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Medication Reminder',
          body: `Don't forget: ${medicationName} - ${dosage}${dosageUnit}`,
          data: {
            medicationId,
            medicationName,
            type: 'escalated_reminder',
          },
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          badge: 1,
          sticky: true, // Persistent notification on Android
          categoryIdentifier: 'URGENT_REMINDER',
        },
        trigger: {
          hour: escalationHour,
          minute: escalationMinute,
          repeats: true,
        } as any,
      });

      return notificationId;
    } catch (error) {
      console.error('Error scheduling escalated reminder:', error);
      return null;
    }
  }

  // Immediate notification (for testing or immediate reminders)
  async sendImmediateNotification(
    title: string,
    body: string,
    data?: any,
    urgent: boolean = false
  ): Promise<string> {
    if (this.isQuietHours() && !urgent) {
      console.log('Skipping notification during quiet hours');
      return '';
    }

    return await Notifications.scheduleNotificationAsync({
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
  }

  // Snooze notification
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
  }

  // Missed medication alert
  async sendMissedMedicationAlert(
    medicationName: string,
    scheduledTime: string
  ): Promise<void> {
    await this.sendImmediateNotification(
      '❗ Missed Medication',
      `You missed ${medicationName} scheduled at ${scheduledTime}`,
      {
        type: 'missed_medication',
        medicationName,
      },
      false
    );
  }

  // Daily summary notification
  async sendDailySummary(
    taken: number,
    total: number,
    adherenceRate: number
  ): Promise<void> {
    let title = '📊 Daily Summary';
    let body = '';
    let emoji = '';

    if (adherenceRate === 100) {
      emoji = '🌟';
      body = `Perfect! You took all ${total} medications today!`;
    } else if (adherenceRate >= 80) {
      emoji = '👍';
      body = `Great job! ${taken}/${total} medications taken (${adherenceRate}%)`;
    } else if (adherenceRate >= 50) {
      emoji = '💪';
      body = `Keep going! ${taken}/${total} medications taken. You can do better tomorrow!`;
    } else {
      emoji = '📋';
      body = `${taken}/${total} medications taken today. Let's improve tomorrow!`;
    }

    await this.sendImmediateNotification(
      `${emoji} ${title}`,
      body,
      { type: 'daily_summary', adherenceRate }
    );
  }

  // Cancel specific notification
  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
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
  }

  // Cancel all notifications
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
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