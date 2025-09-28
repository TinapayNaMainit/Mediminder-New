import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { analyticsService, AdherenceStats, MedicationStats, TimeAnalytics, WeeklyPattern } from '../../services/analyticsService';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const { user } = useAuth();
  const [adherenceStats, setAdherenceStats] = useState<AdherenceStats>({ daily: 0, weekly: 0, monthly: 0, allTime: 0 });
  const [medicationStats, setMedicationStats] = useState<MedicationStats>({
    totalMedications: 0,
    activeMedications: 0,
    totalDoses: 0,
    missedDoses: 0,
    streakDays: 0,
    perfectDays: 0,
  });
  const [timeAnalytics, setTimeAnalytics] = useState<TimeAnalytics>({
    morningCompliance: 0,
    afternoonCompliance: 0,
    eveningCompliance: 0,
    nightCompliance: 0,
  });
  const [weeklyPattern, setWeeklyPattern] = useState<WeeklyPattern[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadAnalytics();
    }, [])
  );

  const loadAnalytics = async () => {
    if (!user?.id) return;

    try {
      const [adherence, medStats, timeStats, pattern, userInsights] = await Promise.all([
        analyticsService.getAdherenceStats(user.id),
        analyticsService.getMedicationStats(user.id),
        analyticsService.getTimeAnalytics(user.id),
        analyticsService.getWeeklyPattern(user.id),
        analyticsService.getInsights(user.id),
      ]);

      setAdherenceStats(adherence);
      setMedicationStats(medStats);
      setTimeAnalytics(timeStats);
      setWeeklyPattern(pattern);
      setInsights(userInsights);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  const getAdherenceColor = (rate: number) => {
    if (rate >= 90) return '#10B981';
    if (rate >= 70) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#667EEA', '#764BA2']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Analytics & Insights</Text>
        <Text style={styles.headerSubtitle}>Track your medication journey</Text>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Adherence Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Adherence Rate</Text>
          <View style={styles.adherenceGrid}>
            <View style={styles.adherenceCard}>
              <LinearGradient
                colors={['#6366F1', '#8B5CF6']}
                style={styles.adherenceCardGradient}
              >
                <Text style={styles.adherenceLabel}>Today</Text>
                <Text style={styles.adherenceValue}>{adherenceStats.daily}%</Text>
              </LinearGradient>
            </View>

            <View style={styles.adherenceCard}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.adherenceCardGradient}
              >
                <Text style={styles.adherenceLabel}>This Week</Text>
                <Text style={styles.adherenceValue}>{adherenceStats.weekly}%</Text>
              </LinearGradient>
            </View>

            <View style={styles.adherenceCard}>
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                style={styles.adherenceCardGradient}
              >
                <Text style={styles.adherenceLabel}>This Month</Text>
                <Text style={styles.adherenceValue}>{adherenceStats.monthly}%</Text>
              </LinearGradient>
            </View>

            <View style={styles.adherenceCard}>
              <LinearGradient
                colors={['#8B5A2B', '#92400E']}
                style={styles.adherenceCardGradient}
              >
                <Text style={styles.adherenceLabel}>All Time</Text>
                <Text style={styles.adherenceValue}>{adherenceStats.allTime}%</Text>
              </LinearGradient>
            </View>
          </View>
        </View>

        {/* Key Statistics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="flame" size={24} color="#EF4444" />
              </View>
              <Text style={styles.statValue}>{medicationStats.streakDays}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>

            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              </View>
              <Text style={styles.statValue}>{medicationStats.totalDoses}</Text>
              <Text style={styles.statLabel}>Total Taken</Text>
            </View>

            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="star" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.statValue}>{medicationStats.perfectDays}</Text>
              <Text style={styles.statLabel}>Perfect Days</Text>
            </View>

            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="close-circle" size={24} color="#EF4444" />
              </View>
              <Text style={styles.statValue}>{medicationStats.missedDoses}</Text>
              <Text style={styles.statLabel}>Missed</Text>
            </View>
          </View>
        </View>

        {/* Weekly Pattern */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Week's Pattern</Text>
          <View style={styles.chartContainer}>
            {weeklyPattern.map((day, index) => {
              const maxValue = Math.max(...weeklyPattern.map(d => d.taken + d.missed + d.skipped), 1);
              const takenHeight = (day.taken / maxValue) * 100;
              const missedHeight = (day.missed / maxValue) * 100;
              
              return (
                <View key={index} style={styles.barContainer}>
                  <View style={styles.bar}>
                    {day.taken > 0 && (
                      <View style={[styles.barSegment, { height: `${takenHeight}%`, backgroundColor: '#10B981' }]} />
                    )}
                    {day.missed > 0 && (
                      <View style={[styles.barSegment, { height: `${missedHeight}%`, backgroundColor: '#EF4444' }]} />
                    )}
                  </View>
                  <Text style={styles.dayLabel}>{day.day}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>Taken</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>Missed</Text>
            </View>
          </View>
        </View>

        {/* Time of Day Analysis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Time of Day Analysis</Text>
          <View style={styles.timeAnalysisContainer}>
            <View style={styles.timeItem}>
              <Ionicons name="sunny" size={32} color="#F59E0B" />
              <Text style={styles.timePeriod}>Morning</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${timeAnalytics.morningCompliance}%`, backgroundColor: getAdherenceColor(timeAnalytics.morningCompliance) }]} />
              </View>
              <Text style={styles.timeValue}>{timeAnalytics.morningCompliance}%</Text>
            </View>

            <View style={styles.timeItem}>
              <Ionicons name="partly-sunny" size={32} color="#F59E0B" />
              <Text style={styles.timePeriod}>Afternoon</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${timeAnalytics.afternoonCompliance}%`, backgroundColor: getAdherenceColor(timeAnalytics.afternoonCompliance) }]} />
              </View>
              <Text style={styles.timeValue}>{timeAnalytics.afternoonCompliance}%</Text>
            </View>

            <View style={styles.timeItem}>
              <Ionicons name="moon" size={32} color="#6366F1" />
              <Text style={styles.timePeriod}>Evening</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${timeAnalytics.eveningCompliance}%`, backgroundColor: getAdherenceColor(timeAnalytics.eveningCompliance) }]} />
              </View>
              <Text style={styles.timeValue}>{timeAnalytics.eveningCompliance}%</Text>
            </View>

            <View style={styles.timeItem}>
              <Ionicons name="moon-outline" size={32} color="#8B5CF6" />
              <Text style={styles.timePeriod}>Night</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${timeAnalytics.nightCompliance}%`, backgroundColor: getAdherenceColor(timeAnalytics.nightCompliance) }]} />
              </View>
              <Text style={styles.timeValue}>{timeAnalytics.nightCompliance}%</Text>
            </View>
          </View>
        </View>

        {/* Insights & Recommendations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personalized Insights</Text>
          {insights.map((insight, index) => (
            <View key={index} style={styles.insightCard}>
              <Ionicons name="bulb" size={24} color="#F59E0B" />
              <Text style={styles.insightText}>{insight}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  adherenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  adherenceCard: {
    width: (width - 44) / 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  adherenceCardGradient: {
    padding: 20,
    alignItems: 'center',
  },
  adherenceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  adherenceValue: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    width: (width - 44) / 2,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 150,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
  },
  bar: {
    width: 24,
    height: 100,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barSegment: {
    width: '100%',
  },
  dayLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 14,
    color: '#6B7280',
  },
  timeAnalysisContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
  },
  timeItem: {
    marginBottom: 20,
  },
  timePeriod: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: '#78350F',
    marginLeft: 12,
    lineHeight: 20,
  },
});