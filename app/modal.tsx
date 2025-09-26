import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export default function AddMedicationModal() {
  const [medicationName, setMedicationName] = useState('');
  const [dosage, setDosage] = useState('');
  const [dosageUnit, setDosageUnit] = useState('mg');
  const [frequency, setFrequency] = useState('Once daily');
  const [reminderHour, setReminderHour] = useState('8');
  const [reminderMinute, setReminderMinute] = useState('00');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

const { user } = useAuth();
const CURRENT_USER_ID = user?.id;
if (!CURRENT_USER_ID) {
  return null;
}

  const handleAdd = async () => {
    if (!medicationName.trim() || !dosage.trim()) {
      Alert.alert('Error', 'Please fill in medication name and dosage');
      return;
    }

    const hour = parseInt(reminderHour);
    const minute = parseInt(reminderMinute);
    
    if (isNaN(hour) || hour < 0 || hour > 23) {
      Alert.alert('Error', 'Please enter a valid hour (0-23)');
      return;
    }
    
    if (isNaN(minute) || minute < 0 || minute > 59) {
      Alert.alert('Error', 'Please enter a valid minute (0-59)');
      return;
    }

    setLoading(true);

    try {
      const formattedTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
      const now = new Date().toISOString();
      
      const medicationData = {
        user_id: CURRENT_USER_ID,
        medication_name: medicationName.trim(),
        dosage: dosage.trim(),
        dosage_unit: dosageUnit,
        frequency: frequency,
        reminder_time: formattedTime,
        notes: notes.trim() || null,
        start_date: new Date().toISOString().split('T')[0],
        is_active: true,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from('medications')
        .insert(medicationData)
        .select()
        .single();

      if (error) throw error;

      Alert.alert(
        'Success!', 
        `${medicationName} has been added successfully.`,
        [
          { 
            text: 'OK', 
            onPress: () => {
              resetForm();
              // Navigate back and trigger refresh
              router.back();
              // Force refresh the home screen by navigating to it
              setTimeout(() => {
                router.push('/(tabs)');
              }, 100);
            }
          }
        ]
      );

    } catch (error: any) {
      console.error('Error adding medication:', error);
      Alert.alert('Error', 'Failed to add medication. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMedicationName('');
    setDosage('');
    setDosageUnit('mg');
    setFrequency('Once daily');
    setReminderHour('8');
    setReminderMinute('00');
    setNotes('');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#6366F1', '#8B5CF6']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="white" />
          </Pressable>
          <Text style={styles.title}>Add New Medication</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Medication Name *</Text>
          <TextInput
            style={styles.input}
            value={medicationName}
            onChangeText={setMedicationName}
            placeholder="e.g., Aspirin, Ibuprofen, Metformin"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="words"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 2, marginRight: 8 }]}>
            <Text style={styles.label}>Dosage *</Text>
            <TextInput
              style={styles.input}
              value={dosage}
              onChangeText={setDosage}
              placeholder="e.g., 100, 2.5, 1"
              keyboardType="numeric"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>Unit</Text>
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerText}>{dosageUnit}</Text>
            </View>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>How often?</Text>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerText}>{frequency}</Text>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Reminder Time</Text>
          <View style={styles.timeInputContainer}>
            <TextInput
              style={[styles.input, styles.timeInput]}
              value={reminderHour}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9]/g, '').slice(0, 2);
                setReminderHour(cleaned);
              }}
              placeholder="08"
              keyboardType="numeric"
              maxLength={2}
              placeholderTextColor="#9CA3AF"
            />
            <Text style={styles.timeSeparator}>:</Text>
            <TextInput
              style={[styles.input, styles.timeInput]}
              value={reminderMinute}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9]/g, '').slice(0, 2);
                setReminderMinute(cleaned);
              }}
              placeholder="00"
              keyboardType="numeric"
              maxLength={2}
              placeholderTextColor="#9CA3AF"
            />
            <View style={styles.timeFormat}>
              <Text style={styles.timeFormatText}>24-hour format</Text>
            </View>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Take with food, before meals, etc."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <Pressable 
          style={[styles.addButton, loading && styles.addButtonDisabled]} 
          onPress={handleAdd}
          disabled={loading}
        >
          <LinearGradient
            colors={loading ? ['#9CA3AF', '#6B7280'] : ['#10B981', '#059669']}
            style={styles.addButtonGradient}
          >
            {loading ? (
              <Ionicons name="refresh" size={24} color="white" />
            ) : (
              <Ionicons name="add" size={24} color="white" />
            )}
            <Text style={styles.addButtonText}>
              {loading ? 'Adding...' : 'Add Medication'}
            </Text>
          </LinearGradient>
        </Pressable>
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
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  form: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'white',
    color: '#374151',
  },
  row: {
    flexDirection: 'row',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    backgroundColor: 'white',
  },
  pickerText: {
    fontSize: 16,
    color: '#374151',
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInput: {
    width: 70,
    textAlign: 'center',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#374151',
    marginHorizontal: 12,
  },
  timeFormat: {
    marginLeft: 16,
  },
  timeFormatText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  addButton: {
    marginTop: 24,
    marginBottom: 40,
    borderRadius: 12,
    overflow: 'hidden',
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  addButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
});