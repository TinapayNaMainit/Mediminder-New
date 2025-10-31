// services/smartReminderService.ts - UPDATED for new frequency system
import * as Notifications from 'expo-notifications';
import { supabase } from './supabaseClient';

interface FrequencySchedule {
  times: string[]; // Array of times in HH:MM format
  timesPerDay: number;
  interval: number; // hours between doses
}

export const smartReminderService = {
  // ✅ UPDATED: Changed to match new frequency options
  getScheduleForFrequency(frequency: string, startTime?: string): FrequencySchedule {
    const schedules: { [key: string]: FrequencySchedule } = {
      // ✅ NEW: Updated frequency options
      'Every 4 hours': {
        times: this.calculateTimesFromStart(startTime || '08:00', 4, 6),
        timesPerDay: 6,
        interval: 4
      },
      'Every 6 hours': {
        times: this.calculateTimesFromStart(startTime || '08:00', 6, 4),
        timesPerDay: 4,
        interval: 6
      },
      'Every 8 hours': {
        times: this.calculateTimesFromStart(startTime || '08:00', 8, 3),
        timesPerDay: 3,
        interval: 8
      },
      'Every 12 hours': {
        times: this.calculateTimesFromStart(startTime || '08:00', 12, 2),
        timesPerDay: 2,
        interval: 12
      },
      // Keep legacy options for backward compatibility
      'Once daily': {
        times: [startTime || '08:00'],
        timesPerDay: 1,
        interval: 24
      },
      'Twice daily': {
        times: this.calculateTimesFromStart(startTime || '08:00', 12, 2),
        timesPerDay: 2,
        interval: 12
      },
      'Three times daily': {
        times: this.calculateTimesFromStart(startTime || '08:00', 8, 3),
        timesPerDay: 3,
        interval: 8
      },
      'Four times daily': {
        times: this.calculateTimesFromStart(startTime || '08:00', 6, 4),
        timesPerDay: 4,
        interval: 6
      },
      'Before meals': {
        times: ['07:30', '12:00', '18:00'],
        timesPerDay: 3,
        interval: 0
      },
      'After meals': {
        times: ['08:30', '13:00', '19:00'],
        timesPerDay: 3,
        interval: 0
      },
      'Bedtime': {
        times: ['22:00'],
        timesPerDay: 1,
        interval: 24
      },
      'As needed': {
        times: [],
        timesPerDay: 0,
        interval: 0
      },
      'Weekly': {
        times: [startTime || '08:00'],
        timesPerDay: 0,
        interval: 168
      },
      'Custom': {
        times: [startTime || '08:00'],
        timesPerDay: 1,
        interval: 0
      }
    };

    return schedules[frequency] || {
      times: [startTime || '08:00'],
      timesPerDay: 1,
      interval: 24
    };
  },

  // ✅ NEW: Calculate reminder times based on start time and interval
  calculateTimesFromStart(startTime: string, intervalHours: number, count: number): string[] {
    const times: string[] = [];
    const [startHour, startMinute] = startTime.split(':').map(Number);
    
    for (let i = 0; i < count; i++) {
      const totalMinutes = (startHour * 60 + startMinute) + (i * intervalHours * 60);
      const hour = Math.floor(totalMinutes / 60) % 24;
      const minute = totalMinutes % 60;
      times.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    }
    
    return times;
  },

  // ✅ Calculate reminder time with advance notification
  calculateReminderTime(scheduledTime: string, advanceMinutes: number): { hour: number; minute: number } {
    const [schedHour, schedMinute] = scheduledTime.split(':').map(Number);
    
    // Calculate total minutes
    let totalMinutes = (schedHour * 60 + schedMinute) - advanceMinutes;
    
    // Handle negative (goes to previous day)
    if (totalMinutes < 0) {
      totalMinutes += 1440; // Add 24 hours in minutes
    }
    
    const hour = Math.floor(totalMinutes / 60) % 24;
    const minute = totalMinutes % 60;
    
    return { hour, minute };
  },

  // ✅ UPDATED: Schedule all notifications with start time support
  async scheduleSmartReminders(
    medicationId: string,
    medicationName: string,
    dosage: string,
    dosageUnit: string,
    frequency: string,
    advanceMinutes: number,
    notes?: string,
    startTime?: string // ✅ NEW: Accept start time parameter
  ): Promise<string[]> {
    try {
      // ✅ Get schedule with start time
      const schedule = this.getScheduleForFrequency(frequency, startTime);
      const notificationIds: string[] = [];

      console.log(`📅 Smart scheduling for ${medicationName}`);
      console.log(`   Frequency: ${frequency}`);
      console.log(`   Start time: ${startTime || 'default'}`);
      console.log(`   Times: ${schedule.times.join(', ')}`);
      console.log(`   Advance warning: ${advanceMinutes} minutes`);

      // Schedule notification for each time
      for (let i = 0; i < schedule.times.length; i++) {
        const scheduledTime = schedule.times[i];
        const { hour, minute } = this.calculateReminderTime(scheduledTime, advanceMinutes);

        const content: Notifications.NotificationContentInput = {
          title: '💊 Time for your medication',
          body: `${medicationName} - ${dosage}${dosageUnit}${notes ? `\n${notes}` : ''}`,
          data: {
            medicationId,
            medicationName,
            dosage,
            dosageUnit,
            notes,
            type: 'smart_reminder',
            scheduledTime,
            reminderIndex: i,
            totalReminders: schedule.times.length,
          },
          sound: 'default',
          badge: 1,
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryIdentifier: 'MEDICATION_REMINDER',
          vibrate: [0, 250, 250, 250],
        };

        // Handle weekly frequency differently
        if (frequency === 'Weekly') {
          const trigger: Notifications.NotificationTriggerInput = {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            channelId: 'medication-reminders',
            weekday: 2, // Monday (1 = Sunday, 2 = Monday, etc.)
            hour,
            minute,
          };

          const notificationId = await Notifications.scheduleNotificationAsync({
            content,
            trigger,
          });

          notificationIds.push(notificationId);
        } else if (frequency !== 'As needed') {
          // Daily frequency
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

          notificationIds.push(notificationId);
        }

        console.log(`   ✅ Scheduled: ${scheduledTime} (reminder at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')})`);
      }

      console.log(`✅ Total scheduled: ${notificationIds.length} notifications`);
      return notificationIds;
    } catch (error) {
      console.error('❌ Error scheduling smart reminders:', error);
      throw error;
    }
  },

  // ✅ UPDATED: Get human-readable schedule description with start time
  getScheduleDescription(frequency: string, advanceMinutes: number, startTime?: string): string {
    const schedule = this.getScheduleForFrequency(frequency, startTime);
    
    if (schedule.times.length === 0) {
      return 'Take as needed (no scheduled reminders)';
    }

    const timesDisplay = schedule.times.map(time => {
      const { hour, minute } = this.calculateReminderTime(time, advanceMinutes);
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const period = hour >= 12 ? 'PM' : 'AM';
      return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
    }).join(', ');

    const advanceText = advanceMinutes > 0 
      ? ` (${advanceMinutes} min before)` 
      : '';

    return `${timesDisplay}${advanceText}`;
  },

  // ✅ Get next dose time
  getNextDoseTime(frequency: string, startTime?: string): string {
    const schedule = this.getScheduleForFrequency(frequency, startTime);
    
    if (schedule.times.length === 0) return 'As needed';

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Find next scheduled time
    for (const time of schedule.times) {
      const [hour, minute] = time.split(':').map(Number);
      const scheduleMinutes = hour * 60 + minute;

      if (scheduleMinutes > currentMinutes) {
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const period = hour >= 12 ? 'PM' : 'AM';
        return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
      }
    }

    // If no time found today, return first time tomorrow
    const [hour, minute] = schedule.times[0].split(':').map(Number);
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const period = hour >= 12 ? 'PM' : 'AM';
    return `Tomorrow at ${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
  },

  // ✅ Update medication with smart schedule
  async updateMedicationSchedule(
    medicationId: string,
    frequency: string,
    advanceMinutes: number,
    startTime?: string // ✅ NEW: Support start time
  ): Promise<void> {
    try {
      const schedule = this.getScheduleForFrequency(frequency, startTime);
      
      // Store the first scheduled time as primary reminder_time for compatibility
      const primaryTime = schedule.times[0] || startTime || '08:00';
      const { hour, minute } = this.calculateReminderTime(primaryTime, advanceMinutes);
      const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

      await supabase
        .from('medications')
        .update({
          reminder_time: formattedTime,
          advance_reminder_minutes: advanceMinutes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', medicationId);

      console.log('✅ Updated medication schedule in database');
    } catch (error) {
      console.error('❌ Error updating medication schedule:', error);
      throw error;
    }
  },

  // ✅ NEW: Helper to format time for display
  formatTimeDisplay(time: string): string {
    const [hour, minute] = time.split(':').map(Number);
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const period = hour >= 12 ? 'PM' : 'AM';
    return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
  },

  // ✅ NEW: Validate frequency string
  isValidFrequency(frequency: string): boolean {
    const validFrequencies = [
      'Every 4 hours',
      'Every 6 hours',
      'Every 8 hours',
      'Every 12 hours',
      'Once daily',
      'Twice daily',
      'Three times daily',
      'Four times daily',
      'Before meals',
      'After meals',
      'Bedtime',
      'As needed',
      'Weekly',
      'Custom'
    ];
    return validFrequencies.includes(frequency);
  }
};