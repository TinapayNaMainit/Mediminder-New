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

export default function MedicationsScreen() {
  const [medications, setMedications] = useState<DatabaseMedication[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

const { user } = useAuth();
const CURRENT_USER_ID = user?.id;
if (!CURRENT_USER_ID) {
  return null;
}

  useFocusEffect(
    useCallback(() => {
      loadMedications();
    }, [])
  );

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
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDeleteMedication = (id: string, name: string) => {
    Alert.alert(
      'Delete Medication',
      `Are you sure you want to delete ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('medications')
                .delete()
                .eq('id', id);

              if (error) throw error;
              setMedications(medications.filter(med => med.id !== id));
            } catch (error) {
              console.error('Error deleting medication:', error);
              Alert.alert('Error', 'Failed to delete medication');
            }
          },
        },
      ]
    );
  };

  const toggleMedicationStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('medications')
        .update({ 
          is_active: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      setMedications(
        medications.map(med =>
          med.id === id ? { ...med, is_active: !currentStatus } : med
        )
      );
    } catch (error) {
      console.error('Error updating medication status:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMedications();
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
              <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.medicationTime}>
                {formatTime(medication.reminder_time)}
              </Text>
            </View>
          </View>
          
          <View style={styles.medicationActions}>
            <Switch
              value={medication.is_active}
              onValueChange={() => toggleMedicationStatus(medication.id, medication.is_active)}
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
            <Text style={styles.statusText}>
              {medication.is_active ? 'Active' : 'Paused'}
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
        <Text style={styles.headerTitle}>My Medications</Text>
        <Text style={styles.headerSubtitle}>
          {medications.filter(m => m.is_active).length} active • {medications.length} total
        </Text>
      </LinearGradient>

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
            <Text style={styles.emptyTitle}>No medications yet</Text>
            <Text style={styles.emptyText}>
              Add your first medication to start tracking your health journey
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
                <Text style={styles.emptyAddButtonText}>Add First Medication</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </ScrollView>

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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
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