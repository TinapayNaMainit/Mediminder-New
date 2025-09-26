import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

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

export default function HistoryScreen() {
  const [logs, setLogs] = useState<LogWithMedication[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    taken: 0,
    missed: 0,
    skipped: 0,
    total: 0,
  });

const { user } = useAuth();
const CURRENT_USER_ID = user?.id;
if (!CURRENT_USER_ID) {
  return null;
}

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [selectedPeriod])
  );

  const loadHistory = async () => {
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
      
      setStats({
        taken,
        missed,
        skipped,
        total: taken + missed + skipped,
      });
      
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
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

  const adherenceRate = stats.total > 0 ? (stats.taken / stats.total) * 100 : 0;

  const renderLogItem = (log: LogWithMedication) => (
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
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
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
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#667EEA', '#764BA2']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>History & Analytics</Text>
        <Text style={styles.headerSubtitle}>Track your medication adherence</Text>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
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

        <View style={styles.statsContainer}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.adherenceCard}
          >
            <Text style={styles.adherenceRate}>{adherenceRate.toFixed(1)}%</Text>
            <Text style={styles.adherenceLabel}>Adherence Rate</Text>
          </LinearGradient>

          <View style={styles.miniStats}>
            <View style={styles.miniStatItem}>
              <Text style={[styles.miniStatNumber, { color: '#10B981' }]}>{stats.taken}</Text>
              <Text style={styles.miniStatLabel}>Taken</Text>
            </View>
            <View style={styles.miniStatItem}>
              <Text style={[styles.miniStatNumber, { color: '#EF4444' }]}>{stats.missed}</Text>
              <Text style={styles.miniStatLabel}>Missed</Text>
            </View>
            <View style={styles.miniStatItem}>
              <Text style={[styles.miniStatNumber, { color: '#F59E0B' }]}>{stats.skipped}</Text>
              <Text style={styles.miniStatLabel}>Skipped</Text>
            </View>
          </View>
        </View>

        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          
          {logs.length > 0 ? (
            logs.map(renderLogItem)
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
    marginHorizontal: 16,
    marginBottom: 24,
    gap: 12,
  },
  adherenceCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  adherenceRate: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
  },
  adherenceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
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
  historySection: {
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
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
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
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