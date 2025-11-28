// app/(tabs)/index.tsx - COMPLETE FIXED VERSION
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
import { useProfile } from '../../contexts/ProfileContext';
import { 
  inventoryService, 
  missedDoseService,
  disposalService 
} from '../../services/medicationEnhancedService';
import { caregiverService } from '../../services/caregiverService';

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

  // Caregiver state
  const [isCaregiver, setIsCaregiver] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  const { user } = useAuth();
  const { profile } = useProfile();
  const CURRENT_USER_ID = user?.id;
  
  if (!CURRENT_USER_ID) {
    return null;
  }

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [])
  );

  // Load user data and check role
  const loadUserData = async () => {
    try {
      setLoading(true);

      if (profile?.role === 'caregiver') {
        setIsCaregiver(true);
        
        const patientsList = await caregiverService.getPatientsForCaregiver(CURRENT_USER_ID);
        setPatients(patientsList);
        
        if (patientsList.length > 0) {
          setSelectedPatient(patientsList[0]);
          await loadPatientData(patientsList[0].id);
        }
      } else {
        setIsCaregiver(false);
        await loadTodaysMedications();
        await loadStats();
        await loadAICompanionStatus();
        checkExpiredMedications();
        checkLowStockMedications();
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIX: Load patient data with robust filtering
  const loadPatientData = async (patientId: string) => {
    try {
      const meds = await caregiverService.getPatientMedications(CURRENT_USER_ID, patientId);
      
      // ✅ FIX: Robust filtering to prevent undefined errors
      const validMeds = (meds || []).filter(med => {
        // Check if medication exists and has required fields
        if (!med || typeof med !== 'object') {
          console.warn('⚠️ Invalid medication object:', med);
          return false;
        }
        
        if (!med.id) {
          console.warn('⚠️ Medication missing ID:', med);
          return false;
        }
        
        if (!med.medication_name) {
          console.warn('⚠️ Medication missing name:', med);
          return false;
        }
        
        return true;
      });
      
      console.log(`✅ Loaded ${validMeds.length} valid medications for patient`);
      
      setTodaysMedications(validMeds);
      await loadPatientLogs(patientId, validMeds);
      await loadPatientStats(patientId);
    } catch (error) {
      console.error('Error loading patient data:', error);
      Alert.alert('Error', 'Failed to load patient medications');
    }
  };

  // Load patient logs
  const loadPatientLogs = async (patientId: string, medications: DatabaseMedication[]) => {
    try {
      const today = getPhilippineDateString();
      
      const { data: logs, error } = await supabase
        .from('medication_logs')
        .select('medication_id, status')
        .eq('user_id', patientId)
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
      console.error('Error loading patient logs:', error);
    }
  };

  // Load patient stats
  const loadPatientStats = async (patientId: string) => {
    try {
      const today = getPhilippineDateString();
      
      const { data: logs, error } = await supabase
        .from('medication_logs')
        .select('status')
        .eq('user_id', patientId)
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

      await loadPatientStreak(patientId);
    } catch (error) {
      console.error('Error loading patient stats:', error);
    }
  };

  // Load patient streak
  const loadPatientStreak = async (patientId: string) => {
    try {
      const { data: medications } = await supabase
        .from('medications')
        .select('id')
        .eq('user_id', patientId)
        .eq('is_active', true);

      const activeMedsCount = medications?.length || 0;
      if (activeMedsCount === 0) {
        setStreak(0);
        return;
      }

      let streakCount = 0;
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
          .eq('user_id', patientId)
          .eq('log_date', dateStr)
          .eq('status', 'taken');

        const takenCount = logs?.length || 0;
        
        if (takenCount >= activeMedsCount) {
          streakCount++;
        } else {
          break;
        }

        checkDate.setDate(checkDate.getDate() - 1);
      }

      setStreak(streakCount);
    } catch (error) {
      console.error('Error calculating patient streak:', error);
      setStreak(0);
    }
  };

  useEffect(() => {
    if (!isCaregiver) {
      loadTodaysMedications();
      loadStats();
      loadAICompanionStatus();

      const missedCheckInterval = setInterval(() => {
        checkAndMarkMissedMedications();
      }, 60000);

      checkExpiredMedications();
      checkLowStockMedications();

      return () => clearInterval(missedCheckInterval);
    }
  }, [isCaregiver]);

  const checkExpiredMedications = async () => {
    if (!CURRENT_USER_ID) return;
    await disposalService.alertExpiredMedications(CURRENT_USER_ID);
  };

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

  // ✅ FIX: Load own medications with robust filtering
  const loadTodaysMedications = async () => {
    try {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('is_active', true)
        .eq('user_id', CURRENT_USER_ID)
        .order('reminder_time', { ascending: true });

      if (error) throw error;

      // ✅ FIX: Robust filtering to prevent undefined errors
      const validMeds = (data || []).filter(med => {
        if (!med || typeof med !== 'object') {
          console.warn('⚠️ Invalid medication object:', med);
          return false;
        }
        
        if (!med.id) {
          console.warn('⚠️ Medication missing ID:', med);
          return false;
        }
        
        if (!med.medication_name) {
          console.warn('⚠️ Medication missing name:', med);
          return false;
        }
        
        return true;
      });

      console.log(`✅ Loaded ${validMeds.length} valid medications`);

      setTodaysMedications(validMeds);
      await loadTodayLogs(validMeds);
      
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
    if (!CURRENT_USER_ID || isCaregiver) return;

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

      let streakCount = 0;
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
          streakCount++;
        } else {
          break;
        }

        checkDate.setDate(checkDate.getDate() - 1);
      }

      setStreak(streakCount);
    } catch (error) {
      console.error('Error calculating streak:', error);
      setStreak(0);
    }
  };

  const handleTakeMedication = async (medicationId: string) => {
    if (isCaregiver) {
      Alert.alert('View Only', 'Caregivers cannot log medications for patients.');
      return;
    }

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
    if (isCaregiver) {
      Alert.alert('View Only', 'Caregivers cannot log medications for patients.');
      return;
    }

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
    if (isCaregiver && selectedPatient) {
      loadPatientData(selectedPatient.id);
    } else {
      loadTodaysMedications();
      loadStats();
      loadAICompanionStatus();
    }
    setRefreshing(false);
  };

  // Patient selector for caregivers
  const renderPatientSelector = () => {
    if (!isCaregiver || patients.length === 0) return null;

    return (
      <View style={styles.patientSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {patients.map((patient) => (
            <Pressable
              key={patient.id}
              style={[
                styles.patientChip,
                selectedPatient?.id === patient.id && styles.patientChipActive
              ]}
              onPress={async () => {
                setSelectedPatient(patient);
                setLoading(true);
                await loadPatientData(patient.id);
                setLoading(false);
              }}
            >
              <Text style={[
                styles.patientChipText,
                selectedPatient?.id === patient.id && styles.patientChipTextActive
              ]}>
                {patient.display_name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#667EEA', '#764BA2']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>
              {isCaregiver ? 'Viewing Patient' : 'Good Morning!'}
            </Text>
            <Text style={styles.date}>
              {isCaregiver && selectedPatient 
                ? selectedPatient.display_name 
                : formatDate(new Date().toISOString())
              }
            </Text>
          </View>
          <View style={styles.streakContainer}>
            <Text style={styles.streakNumber}>{streak}</Text>
            <Text style={styles.streakLabel}>Day Streak</Text>
          </View>
        </View>
      </LinearGradient>

      {renderPatientSelector()}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isCaregiver ? "Patient's Medications" : "Today's Medications"}
          </Text>
          {todaysMedications.length > 0 ? (
            todaysMedications.map((medication) => (
              <MedicationCard
                key={medication.id}
                medication={medication}
                onTake={() => handleTakeMedication(medication.id)}
                onSkip={() => handleSkipMedication(medication.id)}
                takenToday={medicationLogs[medication.id]?.taken || false}
                skippedToday={medicationLogs[medication.id]?.skipped || false}
                isViewOnly={isCaregiver}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="medical-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>
                {loading 
                  ? 'Loading medications...' 
                  : isCaregiver 
                  ? 'No medications for this patient'
                  : 'No medications for today'
                }
              </Text>
              <Text style={styles.emptyText}>
                {loading 
                  ? 'Please wait while we load your data' 
                  : isCaregiver
                  ? 'This patient has not added any medications yet'
                  : 'Add your first medication to get started!'
                }
              </Text>
              {!loading && !isCaregiver && (
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

      {!isCaregiver && aiCompanionEnabled && <AIChatHead userId={CURRENT_USER_ID} />}
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
  patientSelector: { backgroundColor: 'white', paddingVertical: 12, paddingHorizontal: 16 },
  patientChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 8, borderWidth: 2, borderColor: 'transparent' },
  patientChipActive: { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
  patientChipText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  patientChipTextActive: { color: '#6366F1' },
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
  statCard: { flex: 1, padding: 20, borderRadius: 16, alignItems: 'center' },
  statNumber: { fontSize: 28, fontWeight: '700', color: 'white', marginTop: 8 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
});