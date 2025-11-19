// components/MedicationCard.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface Medication {
  id: string;
  medication_name: string;
  dosage: string;
  dosage_unit: string;
  frequency: string;
  reminder_time: string;
  is_active: boolean;
  notes?: string;
}

interface MedicationCardProps {
  medication: Medication;
  onTake: () => void;
  onSkip: () => void;
  nextDose?: string;
  takenToday?: boolean;
  skippedToday?: boolean;
  isViewOnly?: boolean; // ✅ THIS LINE MUST BE HERE
}

const formatTime = (time: string): string => {
  try {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return time;
  }
};

const MedicationCard: React.FC<MedicationCardProps> = ({
  medication,
  onTake,
  onSkip,
  nextDose,
  takenToday = false,
  skippedToday = false,
  isViewOnly = false, // ✅ THIS LINE MUST BE HERE
}) => {
  const [localTaken, setLocalTaken] = useState(takenToday);
  const [localSkipped, setLocalSkipped] = useState(skippedToday);

  const handleTake = () => {
    setLocalTaken(true);
    setLocalSkipped(false);
    onTake();
  };

  const handleSkip = () => {
    setLocalSkipped(true);
    setLocalTaken(false);
    onSkip();
  };

  const isCompleted = localTaken || localSkipped;
  
  const getCardColors = (): [string, string] => {
    if (localTaken) return ['#10B981', '#059669'];
    if (localSkipped) return ['#F59E0B', '#D97706'];
    return ['#667EEA', '#764BA2'];
  };

  return (
    <LinearGradient
      colors={getCardColors()}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={styles.medicationInfo}>
          <Text style={styles.medicationName}>{medication.medication_name}</Text>
          <Text style={styles.dosage}>
            {medication.dosage} {medication.dosage_unit}
          </Text>
          <Text style={styles.frequency}>{medication.frequency}</Text>
        </View>
        <View style={styles.timeContainer}>
          <Ionicons name="time-outline" size={16} color="#E5E7EB" />
          <Text style={styles.time}>
            {formatTime(medication.reminder_time)}
          </Text>
        </View>
      </View>

      {medication.notes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notes}>{medication.notes}</Text>
        </View>
      )}

      {nextDose && !isCompleted && !isViewOnly && (
        <View style={styles.nextDoseContainer}>
          <Text style={styles.nextDoseLabel}>Next dose in:</Text>
          <Text style={styles.nextDose}>{nextDose}</Text>
        </View>
      )}

      {isViewOnly ? (
        <View style={styles.viewOnlyContainer}>
          {isCompleted ? (
            <View style={styles.statusRow}>
              <Ionicons 
                name={localTaken ? "checkmark-circle" : "remove-circle"} 
                size={24} 
                color="white" 
              />
              <Text style={styles.viewOnlyText}>
                {localTaken ? "Patient took this medication" : "Patient skipped this medication"}
              </Text>
            </View>
          ) : (
            <View style={styles.statusRow}>
              <Ionicons name="time-outline" size={24} color="white" />
              <Text style={styles.viewOnlyText}>
                Waiting for patient to log
              </Text>
            </View>
          )}
        </View>
      ) : (
        <>
          {isCompleted ? (
            <View style={styles.completedContainer}>
              <Ionicons 
                name={localTaken ? "checkmark-circle" : "remove-circle"} 
                size={32} 
                color="white" 
              />
              <Text style={styles.completedText}>
                {localTaken ? "Taken Today" : "Skipped Today"}
              </Text>
            </View>
          ) : (
            <View style={styles.actions}>
              <Pressable style={styles.skipButton} onPress={handleSkip}>
                <Ionicons name="close-outline" size={20} color="#EF4444" />
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
              
              <Pressable style={styles.takeButton} onPress={handleTake}>
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.takeButtonGradient}
                >
                  <Ionicons name="checkmark-outline" size={20} color="white" />
                  <Text style={styles.takeText}>Take Now</Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}
        </>
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
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
  dosage: {
    fontSize: 16,
    color: '#E5E7EB',
    marginBottom: 2,
  },
  frequency: {
    fontSize: 14,
    color: '#D1D5DB',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  time: {
    fontSize: 14,
    color: 'white',
    marginLeft: 4,
    fontWeight: '600',
  },
  notesContainer: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  notes: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontStyle: 'italic',
  },
  nextDoseContainer: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  nextDoseLabel: {
    fontSize: 12,
    color: '#D1D5DB',
    marginBottom: 2,
  },
  nextDose: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  skipText: {
    color: '#FCA5A5',
    marginLeft: 6,
    fontWeight: '600',
  },
  takeButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  takeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  takeText: {
    color: 'white',
    marginLeft: 6,
    fontWeight: '700',
    fontSize: 16,
  },
  completedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  completedText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  viewOnlyContainer: {
    paddingVertical: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 12,
    borderRadius: 12,
  },
  viewOnlyText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default MedicationCard;