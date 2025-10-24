// services/analyticsService.ts - COMPLETELY FIXED with proper date handling
import { supabase } from './supabaseClient';

export interface AdherenceStats {
  daily: number;
  weekly: number;
  monthly: number;
  allTime: number;
}

export interface MedicationStats {
  totalMedications: number;
  activeMedications: number;
  totalDoses: number;
  missedDoses: number;
  streakDays: number;
  perfectDays: number;
}

export interface TimeAnalytics {
  morningCompliance: number;
  afternoonCompliance: number;
  eveningCompliance: number;
  nightCompliance: number;
}

export interface WeeklyPattern {
  day: string;
  taken: number;
  missed: number;
  skipped: number;
}

// ✅ FIXED: Get local date string in YYYY-MM-DD format
const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ✅ FIXED: Get date N days ago
const getDaysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getLocalDateString(date);
};

// ✅ FIXED: Get start of week (Sunday)
const getStartOfWeek = (): Date => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);
  return startOfWeek;
};

export const analyticsService = {
  // Calculate adherence rate for a period
  async getAdherenceRate(userId: string, days: number): Promise<number> {
    try {
      const startDate = getDaysAgo(days);
      const today = getLocalDateString();

      console.log(`📊 Calculating adherence for ${days} days: ${startDate} to ${today}`);

      // Get active medications count
      const { data: medications } = await supabase
        .from('medications')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true);

      const totalExpected = (medications?.length || 0) * days;
      if (totalExpected === 0) return 0;

      // Get actual taken logs
      const { data: logs, error } = await supabase
        .from('medication_logs')
        .select('status, log_date')
        .eq('user_id', userId)
        .eq('status', 'taken')
        .gte('log_date', startDate)
        .lte('log_date', today);

      if (error) {
        console.error('Error fetching logs:', error);
        return 0;
      }

      const taken = logs?.length || 0;
      console.log(`   Expected: ${totalExpected}, Taken: ${taken}`);
      
      return totalExpected > 0 ? Math.round((taken / totalExpected) * 100) : 0;
    } catch (error) {
      console.error('Error calculating adherence:', error);
      return 0;
    }
  },

  // Get comprehensive adherence stats
  async getAdherenceStats(userId: string): Promise<AdherenceStats> {
    const [daily, weekly, monthly, allTime] = await Promise.all([
      this.getAdherenceRate(userId, 1),
      this.getAdherenceRate(userId, 7),
      this.getAdherenceRate(userId, 30),
      this.getAdherenceRate(userId, 365)
    ]);

    return { daily, weekly, monthly, allTime };
  },

  // Calculate current streak
  async getCurrentStreak(userId: string): Promise<number> {
    try {
      // Get active medications count
      const { data: medications } = await supabase
        .from('medications')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true);

      const activeMedsCount = medications?.length || 0;
      if (activeMedsCount === 0) return 0;

      let streak = 0;
      let checkDate = new Date();

      // Check backwards from today
      for (let i = 0; i < 365; i++) {
        const dateStr = getLocalDateString(checkDate);

        const { data: logs } = await supabase
          .from('medication_logs')
          .select('status')
          .eq('user_id', userId)
          .eq('log_date', dateStr)
          .eq('status', 'taken');

        const takenCount = logs?.length || 0;
        
        // Perfect day = took all medications
        if (takenCount >= activeMedsCount) {
          streak++;
        } else {
          break;
        }

        checkDate.setDate(checkDate.getDate() - 1);
      }

      return streak;
    } catch (error) {
      console.error('Error calculating streak:', error);
      return 0;
    }
  },

  // Get medication statistics
  async getMedicationStats(userId: string): Promise<MedicationStats> {
    try {
      const { data: allMeds } = await supabase
        .from('medications')
        .select('id, is_active')
        .eq('user_id', userId);

      const { data: logs } = await supabase
        .from('medication_logs')
        .select('status, log_date')
        .eq('user_id', userId);

      const totalMedications = allMeds?.length || 0;
      const activeMedications = allMeds?.filter(m => m.is_active).length || 0;
      const totalDoses = logs?.filter(l => l.status === 'taken').length || 0;
      const missedDoses = logs?.filter(l => l.status === 'missed').length || 0;
      const streakDays = await this.getCurrentStreak(userId);
      
      // Calculate perfect days (all medications taken on same date)
      const dateGroups = new Map<string, number>();
      logs?.forEach(log => {
        if (log.status === 'taken') {
          const count = dateGroups.get(log.log_date) || 0;
          dateGroups.set(log.log_date, count + 1);
        }
      });

      let perfectDays = 0;
      dateGroups.forEach(count => {
        if (count >= activeMedications && activeMedications > 0) {
          perfectDays++;
        }
      });

      return {
        totalMedications,
        activeMedications,
        totalDoses,
        missedDoses,
        streakDays,
        perfectDays,
      };
    } catch (error) {
      console.error('Error getting medication stats:', error);
      return {
        totalMedications: 0,
        activeMedications: 0,
        totalDoses: 0,
        missedDoses: 0,
        streakDays: 0,
        perfectDays: 0,
      };
    }
  },

  // Get time-of-day analytics
  async getTimeAnalytics(userId: string): Promise<TimeAnalytics> {
    try {
      const { data: medications } = await supabase
        .from('medications')
        .select('id, reminder_time')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (!medications || medications.length === 0) {
        return { 
          morningCompliance: 0, 
          afternoonCompliance: 0, 
          eveningCompliance: 0, 
          nightCompliance: 0 
        };
      }

      // Categorize medications by time
      const timeCategories = {
        morning: medications.filter(m => {
          const hour = parseInt(m.reminder_time.split(':')[0]);
          return hour >= 6 && hour < 12;
        }),
        afternoon: medications.filter(m => {
          const hour = parseInt(m.reminder_time.split(':')[0]);
          return hour >= 12 && hour < 17;
        }),
        evening: medications.filter(m => {
          const hour = parseInt(m.reminder_time.split(':')[0]);
          return hour >= 17 && hour < 21;
        }),
        night: medications.filter(m => {
          const hour = parseInt(m.reminder_time.split(':')[0]);
          return hour >= 21 || hour < 6;
        }),
      };

      const calculateCompliance = async (meds: any[]) => {
        if (meds.length === 0) return 0;

        const medIds = meds.map(m => m.id);
        const thirtyDaysAgo = getDaysAgo(30);

        const { data: logs } = await supabase
          .from('medication_logs')
          .select('status')
          .in('medication_id', medIds)
          .eq('user_id', userId)
          .gte('log_date', thirtyDaysAgo);

        const taken = logs?.filter(l => l.status === 'taken').length || 0;
        const total = logs?.length || 0;
        return total > 0 ? Math.round((taken / total) * 100) : 0;
      };

      const [morning, afternoon, evening, night] = await Promise.all([
        calculateCompliance(timeCategories.morning),
        calculateCompliance(timeCategories.afternoon),
        calculateCompliance(timeCategories.evening),
        calculateCompliance(timeCategories.night)
      ]);

      return {
        morningCompliance: morning,
        afternoonCompliance: afternoon,
        eveningCompliance: evening,
        nightCompliance: night
      };
    } catch (error) {
      console.error('Error getting time analytics:', error);
      return { 
        morningCompliance: 0, 
        afternoonCompliance: 0, 
        eveningCompliance: 0, 
        nightCompliance: 0 
      };
    }
  },

  // ✅ FIXED: Get weekly pattern starting from Sunday
  async getWeeklyPattern(userId: string): Promise<WeeklyPattern[]> {
    try {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const pattern: WeeklyPattern[] = [];

      // Start from last Sunday
      const startOfWeek = getStartOfWeek();

      console.log('📊 Getting weekly pattern starting from:', getLocalDateString(startOfWeek));

      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateStr = getLocalDateString(date);
        const dayName = days[date.getDay()];

        console.log(`   Checking ${dayName} (${dateStr})`);

        const { data: logs } = await supabase
          .from('medication_logs')
          .select('status')
          .eq('user_id', userId)
          .eq('log_date', dateStr);

        const taken = logs?.filter(l => l.status === 'taken').length || 0;
        const missed = logs?.filter(l => l.status === 'missed').length || 0;
        const skipped = logs?.filter(l => l.status === 'skipped').length || 0;

        console.log(`      ${dayName}: Taken: ${taken}, Missed: ${missed}, Skipped: ${skipped}`);

        pattern.push({
          day: dayName,
          taken,
          missed,
          skipped,
        });
      }

      return pattern;
    } catch (error) {
      console.error('Error getting weekly pattern:', error);
      return [];
    }
  },

  // Get insights and recommendations
  async getInsights(userId: string): Promise<string[]> {
    const insights: string[] = [];

    try {
      const stats = await this.getMedicationStats(userId);
      const adherenceStats = await this.getAdherenceStats(userId);
      const timeAnalytics = await this.getTimeAnalytics(userId);

      // Streak insights
      if (stats.streakDays >= 7) {
        insights.push(`Excellent! You're on a ${stats.streakDays}-day streak. Keep it up!`);
      } else if (stats.streakDays >= 3) {
        insights.push(`Good job! ${stats.streakDays} days in a row. You're building a healthy habit.`);
      }

      // Adherence insights
      if (adherenceStats.weekly >= 90) {
        insights.push('Outstanding weekly adherence! You\'re taking great care of your health.');
      } else if (adherenceStats.weekly < 70) {
        insights.push('Your adherence has dropped this week. Consider setting more reminders.');
      }

      // Time-based insights
      const timeRates = [
        { name: 'morning', rate: timeAnalytics.morningCompliance },
        { name: 'afternoon', rate: timeAnalytics.afternoonCompliance },
        { name: 'evening', rate: timeAnalytics.eveningCompliance },
        { name: 'night', rate: timeAnalytics.nightCompliance },
      ].filter(t => t.rate > 0);

      if (timeRates.length > 0) {
        const lowest = timeRates.reduce((prev, curr) => prev.rate < curr.rate ? prev : curr);
        if (lowest.rate < 70) {
          insights.push(`You tend to miss ${lowest.name} medications more often. Try setting extra reminders.`);
        }
      }

      // Perfect days insight
      if (stats.perfectDays >= 20) {
        insights.push(`Amazing! You've had ${stats.perfectDays} perfect days of taking all your medications.`);
      }

      // No insights case
      if (insights.length === 0) {
        insights.push('Keep tracking your medications to see personalized insights here!');
      }

      return insights;
    } catch (error) {
      console.error('Error generating insights:', error);
      return ['Unable to generate insights at this time.'];
    }
  },
};