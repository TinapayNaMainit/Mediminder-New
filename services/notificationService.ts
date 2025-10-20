// @ts-nocheck
// services/notificationService.ts - FULLY FIXED
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure notification behavior - will be called in app initialization
export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

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
      console.error('❌ Notification permissions denied');
      return false;
    }

    // Set up Android notification channels
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('medication-reminders', {
        name: 'Medication Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'notification.wav',
        lightColor: '#6366F1',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
        enableLights: true,
        enableVibrate: true,
      });

      console.log('✅ Android notification channel created');
    }

    console.log('✅ Notification permissions granted');
    return true;
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
      // ✅ CRITICAL: Cancel ALL existing notifications for this medication
      await this.cancelMedicationNotifications(medicationId);

      console.log(`📅 Scheduling daily notification for ${medicationName}`);
      console.log(`   Time: ${hour}:${minute.toString().padStart(2, '0')}`);

      // ✅ Schedule ONLY daily repeating notification
      // This prevents any immediate notifications
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
          sound: this.settings.soundEnabled ? 'notification.wav' : undefined,
          priority: Notifications.AndroidNotificationPriority.MAX,
          badge: 1,
          categoryIdentifier: 'MEDICATION_REMINDER',
        },
        trigger: {
          hour: hour,
          minute: minute,
          repeats: true,
        } as Notifications.CalendarTriggerInput,
      });

      console.log(`✅ Notification scheduled successfully`);
      console.log(`   ID: ${notificationId}`);
      console.log(`   Will trigger daily at ${hour}:${minute.toString().padStart(2, '0')}`);

      // Verify it was scheduled
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const found = scheduled.find(n => n.identifier === notificationId);
      
      if (found) {
        console.log('✅ Verification: Notification confirmed in schedule');
      } else {
        console.warn('⚠️ Warning: Notification not found in schedule list');
      }

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
        sound: 'notification.wav',
        priority: Notifications.AndroidNotificationPriority.MAX,
        categoryIdentifier: 'MEDICATION_REMINDER',
      },
      trigger: {
        seconds: snoozeSeconds,
      } as Notifications.TimeIntervalTriggerInput,
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

    if (medicationNotifications.length > 0) {
      console.log(`🗑️ Cancelled ${medicationNotifications.length} notification(s) for medication ${medicationId}`);
    }
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
      if (trigger.type === 'calendar' && trigger.hour !== undefined) {
        console.log(`      Daily at: ${trigger.hour}:${trigger.minute?.toString().padStart(2, '0') || '00'}`);
        console.log(`      Repeats: ${trigger.repeats ? 'Yes' : 'No'}`);
      } else if (trigger.type === 'timeInterval') {
        console.log(`      In ${trigger.seconds} seconds`);
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

    console.log('✅ Notification categories set up');
  }

  setupNotificationResponseHandler(
    onTakeNow: (medicationId: string) => void,
    onSnooze: (medicationId: string) => void,
    onSkip: (medicationId: string) => void
  ): void {
    Notifications.addNotificationResponseReceivedListener((response) => {
      const { actionIdentifier, notification } = response;
      const medicationId = notification.request.content.data?.medicationId as string;

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

export { setupNotificationHandler };

export const formatTimeForNotification = (hour: number, minute: number): string => {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
};

// ✅ TEST FUNCTION - Schedule notification in 1 minute
export const testNotificationIn1Minute = async () => {
  console.log('🧪 Testing notification in 1 minute...');
  
  const now = new Date();
  const testTime = new Date(now.getTime() + 60 * 1000); // 1 minute from now
  
  const testId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '🧪 Test Notification',
      body: 'If you see this, notifications work! Close the app now.',
      sound: 'notification.wav',
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: {
      hour: testTime.getHours(),
      minute: testTime.getMinutes(),
      repeats: false,
    } as Notifications.CalendarTriggerInput,
  });
  
  console.log('✅ Test notification scheduled for:', testTime.toLocaleTimeString());
  return testId;
};

// ✅ TEST FUNCTION - Schedule notification in 30 seconds
export const testNotificationIn30Seconds = async () => {
  console.log('🧪 Testing notification in 30 seconds...');
  
  const testId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '🧪 Quick Test',
      body: 'Notifications are working! Close app now.',
      sound: 'notification.wav',
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: {
      seconds: 30,
    } as Notifications.TimeIntervalTriggerInput,
  });
  
  console.log('✅ Test notification scheduled in 30 seconds');
  return testId;
};