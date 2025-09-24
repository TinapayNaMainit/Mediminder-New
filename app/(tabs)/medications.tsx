import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../services/supabaseClient';
import { useMedications, formatTime } from '../../hooks/useSupabase';
import { Medication } from '../../constants/Types';

export default function MedicationsScreen() {
  const { medications, loading, refetch } = useMedications();
  const [refreshing, setRefreshing] = useState(false);

  const handleDeleteMedication = async (id: string) => {
    Alert.alert(
      'Delete Medication',
      'Are you sure you want to delete this medication?',
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
              refetch();
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
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      refetch();
    } catch (error) {
      console.error('Error updating medication status:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  };

  const renderMedicationItem = (medication: Medication) => (
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
            <Text style={styles.medicationTime}>
              <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.8)" />
              {' '}{formatTime(medication.reminder_time)}
            </Text>
          </View>
          
          <View style={styles.medicationActions}>
            <Pressable
              style={styles.actionButton}
              onPress={() => toggleMedicationStatus(medication.id, medication.is_active)}
            >
              <Ionicons
                name={medication.is_active ? 'pause' : 'play'}
                size={20}
                color="white"
              />
            </Pressable>
            
            <Pressable
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDeleteMedication(medication.id)}
            >
              <Ionicons name="trash-outline" size={20} color="white" />
            </Pressable>
          </View>
        </View>

        {medication.notes && (
          <View style={styles.notesContainer}>
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
          {medications.filter(m => m.is_active).length} active medications
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
              Add your first medication to start tracking your health
            </Text>
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
  },
  medicationInfo: {
    flex: 1,
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
  medicationTime: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  medicationActions: {
    flexDirection: 'row',
    gap: 8,
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
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  notes: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontStyle: 'italic',
  },
  statusContainer: {
    marginTop: 12,
    flexDirection: 'row',
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