import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { supabase, DatabaseMedication, formatDate } from '../../services/supabaseClient';
import MedicationCard from '../../components/MedicationCard';
import { useAuth } from '../../contexts/AuthContext';

interface MedicationStatus {
  taken: boolean;
  skipped: boolean;
  status: 'taken' | 'skipped' | 'missed' | null;
}

export default function HomeScreen() {
  const [todaysMedications, setTodaysMedications] = useState<DatabaseMedication[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<{[key: string]: MedicationStatus}>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState(0);
  const [stats, setStats] = useState({
    taken: 0,
    pending: 0,
    total: 0,
  });

  const { user } = useAuth();
  const CURRENT_USER_ID = user?.id;
  
  if (!CURRENT_USER_ID) {
    return null;
  }

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadTodaysMedications();
      loadStats();
    }, [])
  );

  useEffect(() => {
    loadTodaysMedications();
    loadStats();
  }, []);

  const loadTodaysMedications = async () => {
    try {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('is_active', true)
        .eq('user_id', CURRENT_USER_ID)
        .order('reminder_time', { ascending: true });

      if (error) throw error;

      setTodaysMedications(data || []);
      await loadTodayLogs(data || []);
      
    } catch (error) {
      console.error('Error loading medications:', error);
      setTodaysMedications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadTodayLogs = async (medications: DatabaseMedication[]) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: logs, error } = await supabase
        .from('medication_logs')
        .select('medication_id, status')
        .eq('user_id', CURRENT_USER_ID)
        .eq('log_date', today);

      if (error) throw error;

      const logMap: {[key: string]: MedicationStatus} = {};
      
      // Initialize all medications as not taken/skipped
      medications.forEach(med => {
        logMap[med.id] = {
          taken: false,
          skipped: false,
          status: null
        };
      });
      
      // Update based on actual logs
      logs?.forEach(log => {
        if (logMap[log.medication_id]) {
          logMap[log.medication_id] = {
            taken: log.status === 'taken',
            skipped: log.status === 'skipped',
            status: log.status as 'taken' | 'skipped' | 'missed'
          };
        }
      });
      
      setMedicationLogs(logMap);
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  const loadStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: logs, error } = await supabase
        .from('medication_logs')
        .select('status')
        .eq('user_id', CURRENT_USER_ID)
        .eq('log_date', today);

      if (error) throw error;

      const taken = logs?.filter(log => log.status === 'taken').length || 0;
      const total = logs?.length || 0;
      
      setStats({
        taken,
        pending: Math.max(0, todaysMedications.length - total),
        total,
      });

      // Load actual streak
      await loadCurrentStreak();
      
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadCurrentStreak = async () => {
    try {
      // Get active medications count
      const { data: medications } = await supabase
        .from('medications')
        .select('id')
        .eq('user_id', CURRENT_USER_ID)
        .eq('is_active', true);

      const activeMedsCount = medications?.length || 0;
      if (activeMedsCount === 0) {
        setStreak(0);
        return;
      }

      let streak = 0;
      let checkDate = new Date();

      // Check backwards from today
      for (let i = 0; i < 30; i++) { // Check last 30 days max
        const dateStr = checkDate.toISOString().split('T')[0];

        const { data: logs } = await supabase
          .from('medication_logs')
          .select('status')
          .eq('user_id', CURRENT_USER_ID)
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

      setStreak(streak);
    } catch (error) {
      console.error('Error calculating streak:', error);
      setStreak(0);
    }
  };

  const handleTakeMedication = async (medicationId: string) => {
    try {
      // Optimistically update UI
      setMedicationLogs(prev => ({ 
        ...prev, 
        [medicationId]: { taken: true, skipped: false, status: 'taken' } 
      }));
      
      const today = new Date().toISOString().split('T')[0];
      
      // Check if log already exists for today
      const { data: existingLog } = await supabase
        .from('medication_logs')
        .select('id')
        .eq('medication_id', medicationId)
        .eq('user_id', CURRENT_USER_ID)
        .eq('log_date', today)
        .single();

      if (existingLog) {
        // Update existing log
        const { error } = await supabase
          .from('medication_logs')
          .update({
            status: 'taken',
            logged_at: new Date().toISOString(),
          })
          .eq('id', existingLog.id);

        if (error) throw error;
      } else {
        // Insert new log
        const { error } = await supabase
          .from('medication_logs')
          .insert({
            medication_id: medicationId,
            user_id: CURRENT_USER_ID,
            log_date: today,
            status: 'taken',
            logged_at: new Date().toISOString(),
          });

        if (error) throw error;
      }
      
      await loadStats();
      
    } catch (error) {
      console.error('Error logging medication:', error);
      // Revert optimistic update on error
      setMedicationLogs(prev => ({ 
        ...prev, 
        [medicationId]: { taken: false, skipped: false, status: null } 
      }));
    }
  };

  const handleSkipMedication = async (medicationId: string) => {
    try {
      setMedicationLogs(prev => ({ 
        ...prev, 
        [medicationId]: { taken: false, skipped: true, status: 'skipped' } 
      }));
      
      const today = new Date().toISOString().split('T')[0];
      
      // Check if log already exists for today
      const { data: existingLog } = await supabase
        .from('medication_logs')
        .select('id')
        .eq('medication_id', medicationId)
        .eq('user_id', CURRENT_USER_ID)
        .eq('log_date', today)
        .single();

      if (existingLog) {
        // Update existing log
        const { error } = await supabase
          .from('medication_logs')
          .update({
            status: 'skipped',
            logged_at: new Date().toISOString(),
          })
          .eq('id', existingLog.id);

        if (error) throw error;
      } else {
        // Insert new log
        const { error } = await supabase
          .from('medication_logs')
          .insert({
            medication_id: medicationId,
            user_id: CURRENT_USER_ID,
            log_date: today,
            status: 'skipped',
            logged_at: new Date().toISOString(),
          });

        if (error) throw error;
      }
      
      await loadStats();
      
    } catch (error) {
      console.error('Error skipping medication:', error);
      setMedicationLogs(prev => ({ 
        ...prev, 
        [medicationId]: { taken: false, skipped: false, status: null } 
      }));
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTodaysMedications();
    loadStats();
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#667EEA', '#764BA2']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Good Morning!</Text>
            <Text style={styles.date}>{formatDate(new Date().toISOString())}</Text>
          </View>
          <View style={styles.streakContainer}>
            <Text style={styles.streakNumber}>{streak}</Text>
            <Text style={styles.streakLabel}>Day Streak</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Medications</Text>
          {todaysMedications.length > 0 ? (
            todaysMedications.map((medication) => (
              <MedicationCard
                key={medication.id}
                medication={medication}
                onTake={() => handleTakeMedication(medication.id)}
                onSkip={() => handleSkipMedication(medication.id)}
                takenToday={medicationLogs[medication.id]?.taken || false}
                skippedToday={medicationLogs[medication.id]?.skipped || false}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="medical-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>
                {loading ? 'Loading medications...' : 'No medications for today'}
              </Text>
              <Text style={styles.emptyText}>
                {loading 
                  ? 'Please wait while we load your data' 
                  : 'Add your first medication to get started!'
                }
              </Text>
              {!loading && (
                <Pressable
                  style={styles.addButton}
                  onPress={() => router.push('/modal')}
                >
                  <LinearGradient
                    colors={['#6366F1', '#8B5CF6']}
                    style={styles.addButtonGradient}
                  >
                    <Text style={styles.addButtonText}>Add Medication</Text>
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Progress</Text>
          <View style={styles.statsContainer}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.statCard}
            >
              <Ionicons name="checkmark-circle" size={32} color="white" />
              <Text style={styles.statNumber}>{stats.taken}</Text>
              <Text style={styles.statLabel}>Taken Today</Text>
            </LinearGradient>
            
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              style={styles.statCard}
            >
              <Ionicons name="time" size={32} color="white" />
              <Text style={styles.statNumber}>{stats.pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </LinearGradient>
          </View>
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
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
  },
  date: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  streakContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 16,
    borderRadius: 16,
  },
  streakNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
  },
  streakLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginHorizontal: 16,
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
    marginBottom: 20,
  },
  addButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  addButtonGradient: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
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
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
});