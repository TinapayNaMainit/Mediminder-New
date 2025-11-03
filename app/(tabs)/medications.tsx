// app/(tabs)/medications.tsx - WITH CAREGIVER ACCESS
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  RefreshControl,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { supabase, DatabaseMedication, formatTime } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';
import { notificationService } from '../../services/notificationService';
import { caregiverService } from '../../services/caregiverService';

export default function MedicationsScreen() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [medications, setMedications] = useState<DatabaseMedication[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // ✅ NEW: Caregiver-specific state
  const [isCaregiver, setIsCaregiver] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  const CURRENT_USER_ID = user?.id;
  
  if (!CURRENT_USER_ID) {
    return null;
  }

  // ✅ FIX: Pass selectedPatientId to modal when caregiver
  const handleAddMedication = () => {
    if (isCaregiver && selectedPatient) {
      // Pass patient ID to modal
      router.push({
        pathname: '/modal',
        params: { patientId: selectedPatient.id, patientName: selectedPatient.display_name }
      });
    } else {
      router.push('/modal');
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [])
  );

  // ✅ NEW: Load user data and determine role
  const loadUserData = async () => {
    try {
      setLoading(true);

      // Check if user is a caregiver
      if (profile?.role === 'caregiver') {
        setIsCaregiver(true);
        
        // Load patients for caregiver
        const patientsList = await caregiverService.getPatientsForCaregiver(CURRENT_USER_ID);
        setPatients(patientsList);
        
        // Auto-select first patient if available
        if (patientsList.length > 0) {
          setSelectedPatient(patientsList[0]);
          await loadPatientMedications(patientsList[0].id);
        } else {
          setMedications([]);
        }
      } else {
        // Patient - load own medications
        setIsCaregiver(false);
        await loadMedications();
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ UPDATED: Load patient medications (for caregivers)
  const loadPatientMedications = async (patientId: string) => {
    try {
      const meds = await caregiverService.getPatientMedications(CURRENT_USER_ID, patientId);
      setMedications(meds);
    } catch (error) {
      console.error('Error loading patient medications:', error);
      Alert.alert('Error', 'Failed to load medications');
      setMedications([]);
    }
  };

  // Load own medications (for patients)
  const loadMedications = async () => {
    try {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('user_id', CURRENT_USER_ID)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMedications(data || []);
    } catch (error) {
      console.error('Error loading medications:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // ✅ UPDATED: Handle delete for both roles
  const handleDeleteMedication = (id: string, name: string) => {
    Alert.alert(
      'Delete Medication',
      `Are you sure you want to delete ${name}? This will also cancel all reminders.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isCaregiver && selectedPatient) {
                // Caregiver deleting patient medication
                const success = await caregiverService.deletePatientMedication(
                  CURRENT_USER_ID,
                  selectedPatient.id,
                  id
                );
                
                if (success) {
                  Alert.alert('Success', 'Medication deleted successfully');
                  await loadPatientMedications(selectedPatient.id);
                }
              } else {
                // Patient deleting own medication
                await notificationService.cancelMedicationNotifications(id);
                
                const { error } = await supabase
                  .from('medications')
                  .delete()
                  .eq('id', id);

                if (error) throw error;

                setMedications(medications.filter(med => med.id !== id));
                Alert.alert('Success', 'Medication deleted successfully');
              }
            } catch (error) {
              console.error('Error deleting medication:', error);
              Alert.alert('Error', 'Failed to delete medication');
            }
          },
        },
      ]
    );
  };

  // ✅ UPDATED: Toggle status for both roles
  const toggleMedicationStatus = async (id: string, currentStatus: boolean, medication: DatabaseMedication) => {
    try {
      const newStatus = !currentStatus;
      
      if (isCaregiver && selectedPatient) {
        // Caregiver updating patient medication
        const success = await caregiverService.updatePatientMedication(
          CURRENT_USER_ID,
          selectedPatient.id,
          id,
          { is_active: newStatus }
        );

        if (success) {
          Alert.alert(
            newStatus ? 'Activated' : 'Paused',
            `${medication.medication_name} has been ${newStatus ? 'activated' : 'paused'}`
          );
          await loadPatientMedications(selectedPatient.id);
        }
      } else {
        // Patient updating own medication
        const { error } = await supabase
          .from('medications')
          .update({ 
            is_active: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (error) throw error;

        // Update notifications
        if (newStatus) {
          const [hour, minute] = medication.reminder_time.split(':').map(Number);
          await notificationService.scheduleMedicationReminder(
            id,
            medication.medication_name,
            medication.dosage,
            medication.dosage_unit,
            hour,
            minute,
            medication.notes || undefined
          );
          
          Alert.alert(
            'Activated',
            `${medication.medication_name} is now active. You'll receive daily reminders at ${formatTime(medication.reminder_time)}`
          );
        } else {
          await notificationService.cancelMedicationNotifications(id);
          Alert.alert('Paused', `${medication.medication_name} reminders have been turned off`);
        }
        
        setMedications(
          medications.map(med =>
            med.id === id ? { ...med, is_active: newStatus } : med
          )
        );
      }
    } catch (error) {
      console.error('Error updating medication status:', error);
      Alert.alert('Error', 'Failed to update medication status');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (isCaregiver && selectedPatient) {
      loadPatientMedications(selectedPatient.id);
    } else {
      loadMedications();
    }
  };

  // ✅ NEW: Patient selector for caregivers
  const renderPatientSelector = () => {
    if (!isCaregiver || patients.length === 0) return null;

    return (
      <View style={styles.patientSelector}>
        <Text style={styles.selectorLabel}>Managing medications for:</Text>
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
                await loadPatientMedications(patient.id);
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

  const renderMedicationItem = (medication: DatabaseMedication) => (
    <View key={medication.id} style={styles.medicationItem}>
      <LinearGradient
        colors={medication.is_active ? ['#6366F1', '#8B5CF6'] : ['#9CA3AF', '#6B7280']}
        style={styles.medicationCard}
      >
        <View style={styles.medicationHeader}>
          <View style={styles.medicationInfo}>
            <Text style={styles.medicationName}>{medication.medication_name}</Text>
            <Text style={styles.medicationDetails}>
              {medication.dosage} {medication.dosage_unit} • {medication.frequency}
            </Text>
            <View style={styles.timeRow}>
              <Ionicons name="notifications-outline" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.medicationTime}>
                {formatTime(medication.reminder_time)}
              </Text>
            </View>
          </View>
          
          <View style={styles.medicationActions}>
            <Switch
              value={medication.is_active}
              onValueChange={() => toggleMedicationStatus(medication.id, medication.is_active, medication)}
              trackColor={{ false: 'rgba(255,255,255,0.3)', true: '#10B981' }}
              thumbColor="white"
            />
            
            <Pressable
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDeleteMedication(medication.id, medication.medication_name)}
            >
              <Ionicons name="trash-outline" size={20} color="white" />
            </Pressable>
          </View>
        </View>

        {medication.notes && (
          <View style={styles.notesContainer}>
            <Ionicons name="document-text-outline" size={16} color="rgba(255,255,255,0.8)" />
            <Text style={styles.notes}>{medication.notes}</Text>
          </View>
        )}

        <View style={styles.statusContainer}>
          <View style={[
            styles.statusBadge,
            { backgroundColor: medication.is_active ? '#10B981' : '#6B7280' }
          ]}>
            <Ionicons 
              name={medication.is_active ? "notifications" : "notifications-off"} 
              size={12} 
              color="white" 
            />
            <Text style={styles.statusText}>
              {medication.is_active ? 'Active • Reminders On' : 'Paused • Reminders Off'}
            </Text>
          </View>
          <Text style={styles.createdDate}>
            Added {new Date(medication.created_at).toLocaleDateString()}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#667EEA', '#764BA2']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>
          {isCaregiver ? 'Patient Medications' : 'My Medications'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {isCaregiver 
            ? `${patients.length} patient${patients.length !== 1 ? 's' : ''} • ${medications.filter(m => m.is_active).length} active meds`
            : `${medications.filter(m => m.is_active).length} active • ${medications.length} total`
          }
        </Text>
        {/* ✅ NEW: Show caregiver badge */}
        {isCaregiver && (
          <View style={styles.caregiverBadge}>
            <Ionicons name="heart" size={14} color="white" />
            <Text style={styles.caregiverBadgeText}>Caregiver Mode</Text>
          </View>
        )}
      </LinearGradient>

      {/* ✅ NEW: Patient selector for caregivers */}
      {renderPatientSelector()}

      {/* ✅ NEW: No patients message for caregivers */}
      {isCaregiver && patients.length === 0 ? (
        <View style={styles.noPatients}>
          <Ionicons name="people-outline" size={64} color="#D1D5DB" />
          <Text style={styles.noPatientsTitle}>No Patients Connected</Text>
          <Text style={styles.noPatientsText}>
            Scan a patient's QR code to start managing their medications
          </Text>
          <Pressable
            style={styles.scanButton}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              style={styles.scanButtonGradient}
            >
              <Ionicons name="scan" size={24} color="white" />
              <Text style={styles.scanButtonText}>Scan Patient Code</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {medications.length > 0 ? (
            medications.map(renderMedicationItem)
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="medical-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>
                {isCaregiver ? 'No medications for this patient' : 'No medications yet'}
              </Text>
              <Text style={styles.emptyText}>
                {isCaregiver 
                  ? 'Add medications to help them stay on track'
                  : 'Add your first medication to start tracking your health journey'
                }
              </Text>
              <Pressable
                style={styles.emptyAddButton}
                onPress={() => router.push('/modal')}
              >
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6']}
                  style={styles.emptyAddButtonGradient}
                >
                  <Ionicons name="add" size={24} color="white" />
                  <Text style={styles.emptyAddButtonText}>
                    {isCaregiver ? 'Add Medication for Patient' : 'Add First Medication'}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}

      {/* ✅ UPDATED: FAB shows for both roles */}
      {(!isCaregiver || (isCaregiver && selectedPatient)) && (
        <Pressable
          style={styles.fab}
          onPress={() => router.push('/modal')}
        >
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.fabGradient}
          >
            <Ionicons name="add" size={28} color="white" />
          </LinearGradient>
        </Pressable>
      )}
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
  caregiverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
    gap: 6,
  },
  caregiverBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  patientSelector: {
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  patientChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  patientChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  patientChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  patientChipTextActive: {
    color: '#6366F1',
  },
  noPatients: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noPatientsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  noPatientsText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  scanButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  scanButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 8,
  },
  scanButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  medicationItem: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  medicationCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  medicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  medicationInfo: {
    flex: 1,
    marginRight: 16,
  },
  medicationName: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  medicationDetails: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  medicationTime: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 4,
  },
  medicationActions: {
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 8,
  },
  deleteButton: {
    backgroundColor: 'rgba(239,68,68,0.3)',
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  notes: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontStyle: 'italic',
    marginLeft: 8,
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  createdDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  emptyAddButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyAddButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  emptyAddButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});