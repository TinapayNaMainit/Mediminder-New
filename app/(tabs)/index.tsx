// app/(tabs)/index.tsx - Enhanced with auto-decrement and missed dose adjustment
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { supabase, DatabaseMedication, formatDate } from '../../services/supabaseClient';
import MedicationCard from '../../components/MedicationCard';
import AIChatHead from '../../components/AIChatHead';
import { useAuth } from '../../contexts/AuthContext';
import { 
  inventoryService, 
  missedDoseService,
  disposalService 
} from '../../services/medicationEnhancedService';

interface MedicationStatus {
  taken: boolean;
  skipped: boolean;
  missed: boolean;
  status: 'taken' | 'skipped' | 'missed' | null;
}

const getPhilippineDateString = (): string => {
  const now = new Date();
  const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  const year = phTime.getUTCFullYear();
  const month = String(phTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(phTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const hasMedicationTimePassed = (reminderTime: string): boolean => {
  const now = new Date();
  const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  
  const [reminderHour, reminderMinute] = reminderTime.split(':').map(Number);
  const currentHour = phTime.getUTCHours();
  const currentMinute = phTime.getUTCMinutes();
  
  if (currentHour > reminderHour) return true;
  if (currentHour === reminderHour && currentMinute >= reminderMinute) return true;
  
  return false;
};

export default function HomeScreen() {
  const [todaysMedications, setTodaysMedications] = useState<DatabaseMedication[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<{[key: string]: MedicationStatus}>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState(0);
  const [stats, setStats] = useState({
    taken: 0,
    pending: 0,
    missed: 0,
    total: 0,
  });
  const [aiCompanionEnabled, setAiCompanionEnabled] = useState(true);

  const { user } = useAuth();
  const CURRENT_USER_ID = user?.id;
  
  if (!CURRENT_USER_ID) {
    return null;
  }

  useFocusEffect(
    useCallback(() => {
      loadTodaysMedications();
      loadStats();
      loadAICompanionStatus();
      checkExpiredMedications();
      checkLowStockMedications();
    }, [])
  );

  useEffect(() => {
    loadTodaysMedications();
    loadStats();
    loadAICompanionStatus();

    // Check for missed medications every minute
    const missedCheckInterval = setInterval(() => {
      checkAndMarkMissedMedications();
    }, 60000);

    // ✅ NEW: Check expired medications daily
    checkExpiredMedications();
    
    // ✅ NEW: Check low stock daily
    checkLowStockMedications();

    return () => clearInterval(missedCheckInterval);
  }, []);

  // ✅ NEW: Check for expired medications
  const checkExpiredMedications = async () => {
    if (!CURRENT_USER_ID) return;
    await disposalService.alertExpiredMedications(CURRENT_USER_ID);
  };

  // ✅ NEW: Check for low stock medications
  const checkLowStockMedications = async () => {
    if (!CURRENT_USER_ID) return;
    await inventoryService.checkRefillAlerts(CURRENT_USER_ID);
  };

  const loadAICompanionStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('ai_companion_enabled')
        .eq('user_id', CURRENT_USER_ID)
        .single();

      if (error) throw error;
      setAiCompanionEnabled(data?.ai_companion_enabled ?? true);
    } catch (error) {
      console.error('Error loading AI companion status:', error);
    }
  };

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
      const today = getPhilippineDateString();
      
      const { data: logs, error } = await supabase
        .from('medication_logs')
        .select('medication_id, status')
        .eq('user_id', CURRENT_USER_ID)
        .eq('log_date', today);

      if (error) throw error;

      const logMap: {[key: string]: MedicationStatus} = {};
      
      medications.forEach(med => {
        logMap[med.id] = {
          taken: false,
          skipped: false,
          missed: false,
          status: null
        };
      });
      
      logs?.forEach(log => {
        if (logMap[log.medication_id]) {
          logMap[log.medication_id] = {
            taken: log.status === 'taken',
            skipped: log.status === 'skipped',
            missed: log.status === 'missed',
            status: log.status as 'taken' | 'skipped' | 'missed'
          };
        }
      });
      
      setMedicationLogs(logMap);
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  const checkAndMarkMissedMedications = async () => {
    if (!CURRENT_USER_ID) return;

    try {
      const today = getPhilippineDateString();
      
      for (const med of todaysMedications) {
        if (medicationLogs[med.id]?.status) continue;
        
        if (hasMedicationTimePassed(med.reminder_time)) {
          const [reminderHour, reminderMinute] = med.reminder_time.split(':').map(Number);
          const now = new Date();
          const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
          const currentHour = phTime.getUTCHours();
          const currentMinute = phTime.getUTCMinutes();
          
          const reminderTimeInMinutes = reminderHour * 60 + reminderMinute;
          const currentTimeInMinutes = currentHour * 60 + currentMinute;
          const timeDifference = currentTimeInMinutes - reminderTimeInMinutes;
          
          if (timeDifference >= 60) {
            const { data: existingLog } = await supabase
              .from('medication_logs')
              .select('id')
              .eq('medication_id', med.id)
              .eq('user_id', CURRENT_USER_ID)
              .eq('log_date', today)
              .single();

            if (!existingLog) {
              const { error } = await supabase
                .from('medication_logs')
                .insert({
                  medication_id: med.id,
                  user_id: CURRENT_USER_ID,
                  log_date: today,
                  status: 'missed',
                  logged_at: new Date().toISOString(),
                });

              if (!error) {
                // ✅ NEW: Offer to adjust next dose
                Alert.alert(
                  '⚠️ Missed Dose',
                  `You missed ${med.medication_name} at ${med.reminder_time}.\n\nWould you like to adjust your next reminder?`,
                  [
                    { text: 'No', style: 'cancel' },
                    { 
                      text: 'Adjust Schedule', 
                      onPress: () => missedDoseService.adjustNextDose(med.id, med.reminder_time)
                    }
                  ]
                );

                setMedicationLogs(prev => ({
                  ...prev,
                  [med.id]: { taken: false, skipped: false, missed: true, status: 'missed' }
                }));
              }
            }
          }
        }
      }
      
      await loadStats();
    } catch (error) {
      console.error('Error checking missed medications:', error);
    }
  };

  const loadStats = async () => {
    try {
      const today = getPhilippineDateString();
      
      const { data: logs, error } = await supabase
        .from('medication_logs')
        .select('status')
        .eq('user_id', CURRENT_USER_ID)
        .eq('log_date', today);

      if (error) throw error;

      const taken = logs?.filter(log => log.status === 'taken').length || 0;
      const missed = logs?.filter(log => log.status === 'missed').length || 0;
      const total = todaysMedications.length;
      const logged = logs?.length || 0;
      const pending = Math.max(0, total - logged);
      
      setStats({
        taken,
        pending,
        missed,
        total,
      });

      await loadCurrentStreak();
      
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadCurrentStreak = async () => {
    try {
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

      for (let i = 0; i < 30; i++) {
        const phTime = new Date(checkDate.getTime() + (8 * 60 * 60 * 1000));
        const year = phTime.getUTCFullYear();
        const month = String(phTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(phTime.getUTCDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const { data: logs } = await supabase
          .from('medication_logs')
          .select('status')
          .eq('user_id', CURRENT_USER_ID)
          .eq('log_date', dateStr)
          .eq('status', 'taken');

        const takenCount = logs?.length || 0;
        
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

  // ✅ ENHANCED: Auto-decrement inventory on take
  const handleTakeMedication = async (medicationId: string) => {
    try {
      setMedicationLogs(prev => ({ 
        ...prev, 
        [medicationId]: { taken: true, skipped: false, missed: false, status: 'taken' } 
      }));
      
      const today = getPhilippineDateString();
      
      const { data: existingLog } = await supabase
        .from('medication_logs')
        .select('id')
        .eq('medication_id', medicationId)
        .eq('user_id', CURRENT_USER_ID)
        .eq('log_date', today)
        .single();

      if (existingLog) {
        const { error } = await supabase
          .from('medication_logs')
          .update({
            status: 'taken',
            logged_at: new Date().toISOString(),
          })
          .eq('id', existingLog.id);

        if (error) throw error;
      } else {
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

      // ✅ NEW: Auto-decrement pill count (triggered by database trigger)
      // The database trigger will automatically decrement the quantity
      // We just need to reload the medications to show updated count
      setTimeout(() => {
        loadTodaysMedications();
      }, 500);
      
      await loadStats();
      
    } catch (error) {
      console.error('Error logging medication:', error);
      setMedicationLogs(prev => ({ 
        ...prev, 
        [medicationId]: { taken: false, skipped: false, missed: false, status: null } 
      }));
    }
  };

  const handleSkipMedication = async (medicationId: string) => {
    try {
      setMedicationLogs(prev => ({ 
        ...prev, 
        [medicationId]: { taken: false, skipped: true, missed: false, status: 'skipped' } 
      }));
      
      const today = getPhilippineDateString();
      
      const { data: existingLog } = await supabase
        .from('medication_logs')
        .select('id')
        .eq('medication_id', medicationId)
        .eq('user_id', CURRENT_USER_ID)
        .eq('log_date', today)
        .single();

      if (existingLog) {
        const { error } = await supabase
          .from('medication_logs')
          .update({
            status: 'skipped',
            logged_at: new Date().toISOString(),
          })
          .eq('id', existingLog.id);

        if (error) throw error;
      } else {
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
        [medicationId]: { taken: false, skipped: false, missed: false, status: null } 
      }));
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTodaysMedications();
    loadStats();
    loadAICompanionStatus();
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
              <Text style={styles.statLabel}>Taken</Text>
            </LinearGradient>
            
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              style={styles.statCard}
            >
              <Ionicons name="time" size={32} color="white" />
              <Text style={styles.statNumber}>{stats.pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </LinearGradient>

            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              style={styles.statCard}
            >
              <Ionicons name="alert-circle" size={32} color="white" />
              <Text style={styles.statNumber}>{stats.missed}</Text>
              <Text style={styles.statLabel}>Missed</Text>
            </LinearGradient>
          </View>
        </View>
      </ScrollView>

      {aiCompanionEnabled && <AIChatHead userId={CURRENT_USER_ID} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingTop: 50, paddingBottom: 30, paddingHorizontal: 20 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 28, fontWeight: '700', color: 'white' },
  date: { fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  streakContainer: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', padding: 16, borderRadius: 16 },
  streakNumber: { fontSize: 32, fontWeight: '700', color: 'white' },
  streakLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  content: { flex: 1, paddingTop: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginHorizontal: 16, marginBottom: 16 },
  emptyState: { alignItems: 'center', padding: 40, marginHorizontal: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#6B7280', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 20 },
  addButton: { borderRadius: 12, overflow: 'hidden' },
  addButtonGradient: { paddingHorizontal: 24, paddingVertical: 12 },
  addButtonText: { color: 'white', fontWeight: '600', fontSize: 16 },
  statsContainer: { flexDirection: 'row', paddingHorizontal: 16, gap: 12 },
  statCard: { flex: 1, padding: 20, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  statNumber: { fontSize: 24, fontWeight: '700', color: 'white', marginTop: 8 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
});