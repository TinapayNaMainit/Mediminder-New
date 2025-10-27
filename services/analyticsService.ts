// services/analyticsService.ts - FIXED with Philippine Time (UTC+8) + Performance
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

// ✅ FIX: Get Philippine Time (UTC+8) date string in YYYY-MM-DD format
const getPhilippineDateString = (date: Date = new Date()): string => {
  // Convert to Philippine time by adding 8 hours to UTC
  const phTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));
  const year = phTime.getUTCFullYear();
  const month = String(phTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(phTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ✅ FIX: Get date N days ago in Philippine Time
const getDaysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getPhilippineDateString(date);
};

// ✅ FIX: Get start of week (Sunday) in Philippine Time
const getStartOfWeek = (): Date => {
  const today = new Date();
  // Convert to Philippine time
  const phTime = new Date(today.getTime() + (8 * 60 * 60 * 1000));
  const dayOfWeek = phTime.getUTCDay(); // 0 = Sunday
  const startOfWeek = new Date(phTime);
  startOfWeek.setUTCDate(phTime.getUTCDate() - dayOfWeek);
  startOfWeek.setUTCHours(0, 0, 0, 0);
  return startOfWeek;
};

export const analyticsService = {
  // ✅ OPTIMIZED: Calculate adherence rate with single query
  async getAdherenceRate(userId: string, days: number): Promise<number> {
    try {
      const startDate = getDaysAgo(days);
      const today = getPhilippineDateString();

      // Get active medications count in single query
      const { data: medications, count: medCount } = await supabase
        .from('medications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);

      const totalExpected = (medCount || 0) * days;
      if (totalExpected === 0) return 0;

      // Get taken logs in single query
      const { count: takenCount } = await supabase
        .from('medication_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'taken')
        .gte('log_date', startDate)
        .lte('log_date', today);

      const taken = takenCount || 0;
      return totalExpected > 0 ? Math.round((taken / totalExpected) * 100) : 0;
    } catch (error) {
      console.error('Error calculating adherence:', error);
      return 0;
    }
  },

  // ✅ OPTIMIZED: Get all adherence stats in parallel
  async getAdherenceStats(userId: string): Promise<AdherenceStats> {
    const [daily, weekly, monthly, allTime] = await Promise.all([
      this.getAdherenceRate(userId, 1),
      this.getAdherenceRate(userId, 7),
      this.getAdherenceRate(userId, 30),
      this.getAdherenceRate(userId, 90) // Changed from 365 to 90 for faster loading
    ]);

    return { daily, weekly, monthly, allTime };
  },

  // ✅ OPTIMIZED: Calculate current streak efficiently
  async getCurrentStreak(userId: string): Promise<number> {
    try {
      // Get active medications count
      const { count: activeMedsCount } = await supabase
        .from('medications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (!activeMedsCount || activeMedsCount === 0) return 0;

      let streak = 0;
      let checkDate = new Date();

      // Check only last 30 days for performance
      for (let i = 0; i < 30; i++) {
        const dateStr = getPhilippineDateString(checkDate);

        const { count: takenCount } = await supabase
          .from('medication_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('log_date', dateStr)
          .eq('status', 'taken');

        // Perfect day = took all medications
        if ((takenCount || 0) >= activeMedsCount) {
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

  // ✅ OPTIMIZED: Get medication statistics with single queries
  async getMedicationStats(userId: string): Promise<MedicationStats> {
    try {
      // Parallel queries for better performance
      const [
        { data: allMeds },
        { count: takenCount },
        { count: missedCount },
        streakDays
      ] = await Promise.all([
        supabase
          .from('medications')
          .select('id, is_active')
          .eq('user_id', userId),
        supabase
          .from('medication_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'taken'),
        supabase
          .from('medication_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'missed'),
        this.getCurrentStreak(userId)
      ]);

      const totalMedications = allMeds?.length || 0;
      const activeMedications = allMeds?.filter(m => m.is_active).length || 0;
      const totalDoses = takenCount || 0;
      const missedDoses = missedCount || 0;

      // Calculate perfect days efficiently
      const { data: logs } = await supabase
        .from('medication_logs')
        .select('log_date, status')
        .eq('user_id', userId)
        .eq('status', 'taken');

      const dateGroups = new Map<string, number>();
      logs?.forEach(log => {
        const count = dateGroups.get(log.log_date) || 0;
        dateGroups.set(log.log_date, count + 1);
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

  // ✅ OPTIMIZED: Get time-of-day analytics
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

      // Categorize medications by Philippine Time
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

  // ✅ OPTIMIZED: Get weekly pattern with Philippine Time
  async getWeeklyPattern(userId: string): Promise<WeeklyPattern[]> {
    try {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const startOfWeek = getStartOfWeek();

      // Get all logs for the week in a single query
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const startDateStr = getPhilippineDateString(startOfWeek);
      const endDateStr = getPhilippineDateString(endOfWeek);

      const { data: logs } = await supabase
        .from('medication_logs')
        .select('log_date, status')
        .eq('user_id', userId)
        .gte('log_date', startDateStr)
        .lte('log_date', endDateStr);

      // Group logs by date
      const logsByDate = new Map<string, { taken: number; missed: number; skipped: number }>();
      
      logs?.forEach(log => {
        if (!logsByDate.has(log.log_date)) {
          logsByDate.set(log.log_date, { taken: 0, missed: 0, skipped: 0 });
        }
        const stats = logsByDate.get(log.log_date)!;
        if (log.status === 'taken') stats.taken++;
        else if (log.status === 'missed') stats.missed++;
        else if (log.status === 'skipped') stats.skipped++;
      });

      // Build pattern array
      const pattern: WeeklyPattern[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateStr = getPhilippineDateString(date);
        const dayName = days[date.getUTCDay()];

        const stats = logsByDate.get(dateStr) || { taken: 0, missed: 0, skipped: 0 };
        
        pattern.push({
          day: dayName,
          taken: stats.taken,
          missed: stats.missed,
          skipped: stats.skipped,
        });
      }

      return pattern;
    } catch (error) {
      console.error('Error getting weekly pattern:', error);
      return [];
    }
  },

  // ✅ OPTIMIZED: Get insights
  async getInsights(userId: string): Promise<string[]> {
    const insights: string[] = [];

    try {
      const [stats, adherenceStats, timeAnalytics] = await Promise.all([
        this.getMedicationStats(userId),
        this.getAdherenceStats(userId),
        this.getTimeAnalytics(userId)
      ]);

      // Streak insights
      if (stats.streakDays >= 7) {
        insights.push(`🔥 Excellent! You're on a ${stats.streakDays}-day streak. Keep it up!`);
      } else if (stats.streakDays >= 3) {
        insights.push(`✨ Good job! ${stats.streakDays} days in a row. You're building a healthy habit.`);
      }

      // Adherence insights
      if (adherenceStats.weekly >= 90) {
        insights.push('⭐ Outstanding weekly adherence! You\'re taking great care of your health.');
      } else if (adherenceStats.weekly < 70) {
        insights.push('💡 Your adherence has dropped this week. Consider setting more reminders.');
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
          insights.push(`⏰ You tend to miss ${lowest.name} medications more often. Try setting extra reminders.`);
        }
      }

      // Perfect days insight
      if (stats.perfectDays >= 20) {
        insights.push(`🎯 Amazing! You've had ${stats.perfectDays} perfect days of taking all your medications.`);
      }

      // No insights case
      if (insights.length === 0) {
        insights.push('📊 Keep tracking your medications to see personalized insights here!');
      }

      return insights;
    } catch (error) {
      console.error('Error generating insights:', error);
      return ['Unable to generate insights at this time.'];
    }
  },
};