import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { analyticsService, AdherenceStats, MedicationStats, TimeAnalytics, WeeklyPattern } from '../../services/analyticsService';

const { width } = Dimensions.get('window');

interface LogWithMedication {
  id: string;
  medication_id: string;
  user_id: string;
  log_date: string;
  status: 'taken' | 'missed' | 'skipped';
  notes?: string;
  logged_at: string;
  medications: {
    medication_name: string;
    dosage: string;
    dosage_unit: string;
  };
}

type TabType = 'overview' | 'history' | 'insights';

export default function EnhancedAnalyticsScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Analytics data
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

  // History data
  const [logs, setLogs] = useState<LogWithMedication[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [historyStats, setHistoryStats] = useState({
    taken: 0,
    missed: 0,
    skipped: 0,
    total: 0,
  });

  const CURRENT_USER_ID = user?.id;

  useFocusEffect(
    useCallback(() => {
      if (CURRENT_USER_ID) {
        loadAllData();
      }
    }, [CURRENT_USER_ID, selectedPeriod, activeTab])
  );

  useEffect(() => {
    if (CURRENT_USER_ID) {
      loadAllData();
    }
  }, [selectedPeriod, activeTab]);

  const loadAllData = async () => {
    if (!CURRENT_USER_ID) return;

    try {
      setLoading(true);
      await Promise.all([
        loadAnalytics(),
        loadHistory(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadAnalytics = async () => {
    if (!CURRENT_USER_ID) return;

    try {
      const [adherence, medStats, timeStats, pattern, userInsights] = await Promise.all([
        analyticsService.getAdherenceStats(CURRENT_USER_ID),
        analyticsService.getMedicationStats(CURRENT_USER_ID),
        analyticsService.getTimeAnalytics(CURRENT_USER_ID),
        analyticsService.getWeeklyPattern(CURRENT_USER_ID),
        analyticsService.getInsights(CURRENT_USER_ID),
      ]);

      setAdherenceStats(adherence);
      setMedicationStats(medStats);
      setTimeAnalytics(timeStats);
      setWeeklyPattern(pattern);
      setInsights(userInsights);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const loadHistory = async () => {
    if (!CURRENT_USER_ID) return;

    try {
      let query = supabase
        .from('medication_logs')
        .select(`
          *,
          medications (medication_name, dosage, dosage_unit)
        `)
        .eq('user_id', CURRENT_USER_ID)
        .order('logged_at', { ascending: false });

      const now = new Date();
      if (selectedPeriod === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        query = query.gte('logged_at', weekAgo.toISOString());
      } else if (selectedPeriod === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        query = query.gte('logged_at', monthAgo.toISOString());
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      
      const logsWithMeds = data as LogWithMedication[];
      setLogs(logsWithMeds || []);
      
      const taken = logsWithMeds.filter(log => log.status === 'taken').length;
      const missed = logsWithMeds.filter(log => log.status === 'missed').length;
      const skipped = logsWithMeds.filter(log => log.status === 'skipped').length;
      
      setHistoryStats({
        taken,
        missed,
        skipped,
        total: taken + missed + skipped,
      });
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAllData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'taken': return '#10B981';
      case 'missed': return '#EF4444';
      case 'skipped': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'taken': return 'checkmark-circle';
      case 'missed': return 'close-circle';
      case 'skipped': return 'remove-circle';
      default: return 'help-circle';
    }
  };

  const getAdherenceColor = (rate: number) => {
    if (rate >= 90) return '#10B981';
    if (rate >= 70) return '#F59E0B';
    return '#EF4444';
  };

  const renderTabButton = (tab: TabType, title: string, icon: string) => (
    <Pressable
      key={tab}
      style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
      onPress={() => setActiveTab(tab)}
    >
      <Ionicons name={icon as any} size={18} color={activeTab === tab ? '#6366F1' : '#6B7280'} />
      <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
        {title}
      </Text>
    </Pressable>
  );

  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      {/* Adherence Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Adherence Rate</Text>
        <View style={styles.adherenceGrid}>
          <View style={styles.adherenceCard}>
            <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.adherenceCardGradient}>
              <Text style={styles.adherenceLabel}>Today</Text>
              <Text style={styles.adherenceValue}>{adherenceStats.daily}%</Text>
            </LinearGradient>
          </View>
          <View style={styles.adherenceCard}>
            <LinearGradient colors={['#10B981', '#059669']} style={styles.adherenceCardGradient}>
              <Text style={styles.adherenceLabel}>This Week</Text>
              <Text style={styles.adherenceValue}>{adherenceStats.weekly}%</Text>
            </LinearGradient>
          </View>
          <View style={styles.adherenceCard}>
            <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.adherenceCardGradient}>
              <Text style={styles.adherenceLabel}>This Month</Text>
              <Text style={styles.adherenceValue}>{adherenceStats.monthly}%</Text>
            </LinearGradient>
          </View>
          <View style={styles.adherenceCard}>
            <LinearGradient colors={['#8B5A2B', '#92400E']} style={styles.adherenceCardGradient}>
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

      {/* Weekly Pattern Chart */}
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
    </View>
  );

  const renderHistoryTab = () => {
    const adherenceRate = historyStats.total > 0 ? (historyStats.taken / historyStats.total) * 100 : 0;

    return (
      <View style={styles.tabContent}>
        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {(['week', 'month', 'all'] as const).map((period) => (
            <Pressable
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && styles.periodButtonActive,
              ]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text
                style={[
                  styles.periodText,
                  selectedPeriod === period && styles.periodTextActive,
                ]}
              >
                {period === 'week' ? 'This Week' : 
                 period === 'month' ? 'This Month' : 'All Time'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* History Stats */}
        <View style={styles.historyStatsContainer}>
          <LinearGradient colors={['#10B981', '#059669']} style={styles.adherenceCard}>
            <Text style={styles.adherenceRate}>{adherenceRate.toFixed(1)}%</Text>
            <Text style={styles.adherenceLabel}>Adherence Rate</Text>
          </LinearGradient>

          <View style={styles.miniStats}>
            <View style={styles.miniStatItem}>
              <Text style={[styles.miniStatNumber, { color: '#10B981' }]}>{historyStats.taken}</Text>
              <Text style={styles.miniStatLabel}>Taken</Text>
            </View>
            <View style={styles.miniStatItem}>
              <Text style={[styles.miniStatNumber, { color: '#EF4444' }]}>{historyStats.missed}</Text>
              <Text style={styles.miniStatLabel}>Missed</Text>
            </View>
            <View style={styles.miniStatItem}>
              <Text style={[styles.miniStatNumber, { color: '#F59E0B' }]}>{historyStats.skipped}</Text>
              <Text style={styles.miniStatLabel}>Skipped</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {logs.length > 0 ? (
            logs.map((log) => (
              <View key={log.id} style={styles.logItem}>
                <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(log.status) }]}>
                  <Ionicons name={getStatusIcon(log.status) as any} size={20} color="white" />
                </View>
                
                <View style={styles.logContent}>
                  <Text style={styles.medicationName}>{log.medications?.medication_name}</Text>
                  <Text style={styles.logDetails}>
                    {log.medications?.dosage} {log.medications?.dosage_unit}
                  </Text>
                  <Text style={styles.logTime}>
                    {new Date(log.logged_at).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })} at{' '}
                    {new Date(log.logged_at).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}
                  </Text>
                  {log.notes && (
                    <Text style={styles.logNotes}>{log.notes}</Text>
                  )}
                </View>
                
                <View style={styles.statusBadge}>
                  <Text style={[styles.statusText, { color: getStatusColor(log.status) }]}>
                    {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="analytics-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No history yet</Text>
              <Text style={styles.emptyText}>
                Your medication history will appear here once you start logging
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderInsightsTab = () => (
    <View style={styles.tabContent}>
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

      {/* Personalized Insights */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personalized Insights</Text>
        {insights.map((insight, index) => (
          <View key={index} style={styles.insightCard}>
            <Ionicons name="bulb" size={24} color="#F59E0B" />
            <Text style={styles.insightText}>{insight}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  if (!CURRENT_USER_ID) return null;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.header}>
        <Text style={styles.headerTitle}>Analytics & Insights</Text>
        <Text style={styles.headerSubtitle}>Track your medication journey</Text>
      </LinearGradient>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {renderTabButton('overview', 'Overview', 'stats-chart')}
        {renderTabButton('history', 'History', 'time')}
        {renderTabButton('insights', 'Insights', 'bulb')}
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'history' && renderHistoryTab()}
        {activeTab === 'insights' && renderInsightsTab()}
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
    paddingBottom: 50,
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: -24,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  tabButtonActive: {
    backgroundColor: '#EEF2FF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#6366F1',
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  tabContent: {
    paddingBottom: 40,
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
    justifyContent: 'center',
    minHeight: 120,
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
  adherenceRate: {
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
  periodSelector: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  periodText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  periodTextActive: {
    color: '#6366F1',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  historyStatsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 24,
    gap: 12,
  },
  miniStats: {
    flex: 1,
    justifyContent: 'space-between',
  },
  miniStatItem: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  miniStatNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  miniStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statusIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logContent: {
    flex: 1,
  },
  medicationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  logDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  logTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  logNotes: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
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
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
});