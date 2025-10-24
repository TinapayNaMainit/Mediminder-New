// app/(tabs)/analytics.tsx - FIXED ANALYTICS SCREEN
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { analyticsService, AdherenceStats, MedicationStats, TimeAnalytics, WeeklyPattern } from '../../services/analyticsService';

export default function AnalyticsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adherenceStats, setAdherenceStats] = useState<AdherenceStats | null>(null);
  const [medicationStats, setMedicationStats] = useState<MedicationStats | null>(null);
  const [timeAnalytics, setTimeAnalytics] = useState<TimeAnalytics | null>(null);
  const [weeklyPattern, setWeeklyPattern] = useState<WeeklyPattern[]>([]);
  const [insights, setInsights] = useState<string[]>([]);

  const CURRENT_USER_ID = user?.id;

  useFocusEffect(
    useCallback(() => {
      if (CURRENT_USER_ID) {
        loadAnalytics();
      }
    }, [CURRENT_USER_ID])
  );

  const loadAnalytics = async () => {
    if (!CURRENT_USER_ID) return;

    try {
      setLoading(true);

      // Load all analytics data
      const [adherence, medStats, timeData, pattern, userInsights] = await Promise.all([
        analyticsService.getAdherenceStats(CURRENT_USER_ID),
        analyticsService.getMedicationStats(CURRENT_USER_ID),
        analyticsService.getTimeAnalytics(CURRENT_USER_ID),
        analyticsService.getWeeklyPattern(CURRENT_USER_ID),
        analyticsService.getInsights(CURRENT_USER_ID),
      ]);

      setAdherenceStats(adherence);
      setMedicationStats(medStats);
      setTimeAnalytics(timeData);
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

  if (!CURRENT_USER_ID) return null;

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.loadingGradient}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.loadingText}>Loading Analytics...</Text>
        </LinearGradient>
      </View>
    );
  }

  const getAdherenceColor = (rate: number): string => {
    if (rate >= 90) return '#10B981';
    if (rate >= 70) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.header}>
        <Text style={styles.headerTitle}>Analytics</Text>
        <Text style={styles.headerSubtitle}>Track your medication adherence</Text>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Adherence Overview */}
        {adherenceStats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Adherence Overview</Text>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: getAdherenceColor(adherenceStats.daily) }]}>
                <Text style={styles.statNumber}>{adherenceStats.daily}%</Text>
                <Text style={styles.statLabel}>Today</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: getAdherenceColor(adherenceStats.weekly) }]}>
                <Text style={styles.statNumber}>{adherenceStats.weekly}%</Text>
                <Text style={styles.statLabel}>This Week</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: getAdherenceColor(adherenceStats.monthly) }]}>
                <Text style={styles.statNumber}>{adherenceStats.monthly}%</Text>
                <Text style={styles.statLabel}>This Month</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: getAdherenceColor(adherenceStats.allTime) }]}>
                <Text style={styles.statNumber}>{adherenceStats.allTime}%</Text>
                <Text style={styles.statLabel}>All Time</Text>
              </View>
            </View>
          </View>
        )}

        {/* Medication Stats */}
        {medicationStats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Medication Statistics</Text>
            <View style={styles.card}>
              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Ionicons name="medical" size={24} color="#6366F1" />
                  <Text style={styles.statValue}>{medicationStats.totalMedications}</Text>
                  <Text style={styles.statItemLabel}>Total Meds</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  <Text style={styles.statValue}>{medicationStats.totalDoses}</Text>
                  <Text style={styles.statItemLabel}>Doses Taken</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="flame" size={24} color="#F59E0B" />
                  <Text style={styles.statValue}>{medicationStats.streakDays}</Text>
                  <Text style={styles.statItemLabel}>Day Streak</Text>
                </View>
              </View>
              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Ionicons name="star" size={24} color="#8B5CF6" />
                  <Text style={styles.statValue}>{medicationStats.perfectDays}</Text>
                  <Text style={styles.statItemLabel}>Perfect Days</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="close-circle" size={24} color="#EF4444" />
                  <Text style={styles.statValue}>{medicationStats.missedDoses}</Text>
                  <Text style={styles.statItemLabel}>Missed</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="pulse" size={24} color="#10B981" />
                  <Text style={styles.statValue}>{medicationStats.activeMedications}</Text>
                  <Text style={styles.statItemLabel}>Active</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Weekly Pattern */}
        {weeklyPattern.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Weekly Pattern</Text>
            <View style={styles.card}>
              <View style={styles.chartContainer}>
                {weeklyPattern.map((day, index) => {
                  const total = day.taken + day.missed + day.skipped;
                  const takenPercent = total > 0 ? (day.taken / total) * 100 : 0;
                  
                  return (
                    <View key={index} style={styles.barContainer}>
                      <View style={styles.bar}>
                        <View 
                          style={[
                            styles.barFill, 
                            { 
                              height: `${takenPercent}%`,
                              backgroundColor: takenPercent >= 80 ? '#10B981' : takenPercent >= 50 ? '#F59E0B' : '#EF4444'
                            }
                          ]} 
                        />
                      </View>
                      <Text style={styles.barLabel}>{day.day}</Text>
                      <Text style={styles.barValue}>{day.taken}</Text>
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
                  <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.legendText}>Missed</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.legendText}>Skipped</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Time of Day Analytics */}
        {timeAnalytics && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Time of Day Compliance</Text>
            <View style={styles.card}>
              <View style={styles.timeRow}>
                <Ionicons name="sunny" size={24} color="#F59E0B" />
                <Text style={styles.timeLabel}>Morning</Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${timeAnalytics.morningCompliance}%`,
                        backgroundColor: getAdherenceColor(timeAnalytics.morningCompliance)
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.timeValue}>{timeAnalytics.morningCompliance}%</Text>
              </View>
              <View style={styles.timeRow}>
                <Ionicons name="partly-sunny" size={24} color="#EAB308" />
                <Text style={styles.timeLabel}>Afternoon</Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${timeAnalytics.afternoonCompliance}%`,
                        backgroundColor: getAdherenceColor(timeAnalytics.afternoonCompliance)
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.timeValue}>{timeAnalytics.afternoonCompliance}%</Text>
              </View>
              <View style={styles.timeRow}>
                <Ionicons name="moon" size={24} color="#6366F1" />
                <Text style={styles.timeLabel}>Evening</Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${timeAnalytics.eveningCompliance}%`,
                        backgroundColor: getAdherenceColor(timeAnalytics.eveningCompliance)
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.timeValue}>{timeAnalytics.eveningCompliance}%</Text>
              </View>
              <View style={styles.timeRow}>
                <Ionicons name="moon-outline" size={24} color="#8B5CF6" />
                <Text style={styles.timeLabel}>Night</Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${timeAnalytics.nightCompliance}%`,
                        backgroundColor: getAdherenceColor(timeAnalytics.nightCompliance)
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.timeValue}>{timeAnalytics.nightCompliance}%</Text>
              </View>
            </View>
          </View>
        )}

        {/* Insights */}
        {insights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Insights & Recommendations</Text>
            {insights.map((insight, index) => (
              <View key={index} style={styles.insightCard}>
                <Ionicons name="bulb" size={24} color="#F59E0B" />
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
  },
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: 'white',
    marginTop: 16,
    fontWeight: '600',
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
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
  },
  statItemLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 200,
    marginBottom: 16,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  bar: {
    width: 30,
    height: 150,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  barValue: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    width: 80,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    width: 45,
    textAlign: 'right',
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
});