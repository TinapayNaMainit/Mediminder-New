// app/modal.tsx - IMPROVED with Medical Frequency Standards
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  Pressable,
  Switch,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notificationService';

type TabType = 'basic' | 'inventory';
type ReminderMode = 'now' | 'custom';

interface FrequencyOption {
  label: string;
  value: string;
  description: string;
  interval: number; // hours between doses
  timesPerDay: number;
  medicalTerm?: string;
  examples?: string;
}

interface MedicationToAdd {
  id: string;
  name: string;
  dosage: string;
  unit: string;
  frequency: string;
  notes: string;
  reminderMode: ReminderMode;
  reminderOffset: number;
  customHour: number;
  customMinute: number;
}

export default function AddOrEditMedicationModal() {
  const params = useLocalSearchParams();
  const editingMedication = params?.medication ? JSON.parse(params.medication as string) : null;
  const isEditing = !!editingMedication;
  const isBulkMode = !isEditing;

  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [medications, setMedications] = useState<MedicationToAdd[]>([
    {
      id: '1',
      name: '',
      dosage: '',
      unit: 'mg',
      frequency: 'Once daily',
      notes: '',
      reminderMode: 'now',
      reminderOffset: 5,
      customHour: 8,
      customMinute: 0,
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [showFrequencyInfo, setShowFrequencyInfo] = useState(false);
  const [selectedFrequencyInfo, setSelectedFrequencyInfo] = useState<FrequencyOption | null>(null);

  // Inventory tracking
  const [trackInventory, setTrackInventory] = useState(false);
  const [totalQuantity, setTotalQuantity] = useState('30');
  const [currentQuantity, setCurrentQuantity] = useState('30');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [startDate, setStartDate] = useState(new Date());
  const [expiryDate, setExpiryDate] = useState(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showExpiryDatePicker, setShowExpiryDatePicker] = useState(false);

  const { user } = useAuth();
  const CURRENT_USER_ID = user?.id;

  if (!CURRENT_USER_ID) return null;

  const dosageUnits = ['mg', 'g', 'mcg', 'ml', 'tablets', 'capsules', 'drops', 'puffs'];
  
  // ✅ IMPROVED: Medical-standard frequency options
  const frequencies: FrequencyOption[] = [
    {
      label: 'Once daily',
      value: 'Once daily',
      description: 'Take once every 24 hours',
      interval: 24,
      timesPerDay: 1,
      medicalTerm: 'QD (once daily)',
      examples: 'e.g., 8:00 AM daily'
    },
    {
      label: 'Twice daily (BID)',
      value: 'Twice daily',
      description: 'Take every 12 hours',
      interval: 12,
      timesPerDay: 2,
      medicalTerm: 'BID (bis in die)',
      examples: 'e.g., 8:00 AM and 8:00 PM'
    },
    {
      label: 'Three times daily (TID)',
      value: 'Three times daily',
      description: 'Take every 8 hours',
      interval: 8,
      timesPerDay: 3,
      medicalTerm: 'TID (ter in die)',
      examples: 'e.g., 8:00 AM, 4:00 PM, 12:00 AM'
    },
    {
      label: 'Four times daily (QID)',
      value: 'Four times daily',
      description: 'Take every 6 hours',
      interval: 6,
      timesPerDay: 4,
      medicalTerm: 'QID (quater in die)',
      examples: 'e.g., 6:00 AM, 12:00 PM, 6:00 PM, 12:00 AM'
    },
    {
      label: 'Every 4 hours',
      value: 'Every 4 hours',
      description: 'Take every 4 hours (6 times daily)',
      interval: 4,
      timesPerDay: 6,
      examples: 'e.g., 8:00 AM, 12:00 PM, 4:00 PM, 8:00 PM, 12:00 AM, 4:00 AM'
    },
    {
      label: 'Every 6 hours',
      value: 'Every 6 hours',
      description: 'Take every 6 hours (4 times daily)',
      interval: 6,
      timesPerDay: 4,
      examples: 'e.g., 6:00 AM, 12:00 PM, 6:00 PM, 12:00 AM'
    },
    {
      label: 'Every 8 hours',
      value: 'Every 8 hours',
      description: 'Take every 8 hours (3 times daily)',
      interval: 8,
      timesPerDay: 3,
      examples: 'e.g., 8:00 AM, 4:00 PM, 12:00 AM'
    },
    {
      label: 'Every 12 hours',
      value: 'Every 12 hours',
      description: 'Take every 12 hours (2 times daily)',
      interval: 12,
      timesPerDay: 2,
      examples: 'e.g., 8:00 AM and 8:00 PM'
    },
    {
      label: 'Before meals (AC)',
      value: 'Before meals',
      description: 'Take 30-60 min before breakfast, lunch, dinner',
      interval: 0,
      timesPerDay: 3,
      medicalTerm: 'AC (ante cibum)',
      examples: 'e.g., 7:00 AM, 11:30 AM, 5:30 PM'
    },
    {
      label: 'After meals (PC)',
      value: 'After meals',
      description: 'Take immediately after breakfast, lunch, dinner',
      interval: 0,
      timesPerDay: 3,
      medicalTerm: 'PC (post cibum)',
      examples: 'e.g., 8:30 AM, 1:00 PM, 7:00 PM'
    },
    {
      label: 'Bedtime (HS)',
      value: 'Bedtime',
      description: 'Take once at bedtime',
      interval: 24,
      timesPerDay: 1,
      medicalTerm: 'HS (hora somni)',
      examples: 'e.g., 10:00 PM'
    },
    {
      label: 'As needed (PRN)',
      value: 'As needed',
      description: 'Take only when needed (no regular schedule)',
      interval: 0,
      timesPerDay: 0,
      medicalTerm: 'PRN (pro re nata)',
      examples: 'Take when experiencing symptoms'
    },
    {
      label: 'Weekly',
      value: 'Weekly',
      description: 'Take once per week on same day',
      interval: 168,
      timesPerDay: 0,
      examples: 'e.g., Every Monday at 9:00 AM'
    },
  ];

  const reminderOffsets = [
    { label: 'Now', value: 0 },
    { label: '5 min', value: 5 },
    { label: '10 min', value: 10 },
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '1 hour', value: 60 },
  ];

  useEffect(() => {
    if (editingMedication) {
      const [hour, minute] = editingMedication.reminder_time.split(':').map(Number);
      setMedications([{
        id: '1',
        name: editingMedication.medication_name,
        dosage: editingMedication.dosage,
        unit: editingMedication.dosage_unit,
        frequency: editingMedication.frequency,
        notes: editingMedication.notes || '',
        reminderMode: 'custom',
        reminderOffset: 5,
        customHour: hour,
        customMinute: minute,
      }]);
      setTrackInventory(editingMedication.total_quantity > 0);
      if (editingMedication.total_quantity > 0) {
        setTotalQuantity(editingMedication.total_quantity.toString());
        setCurrentQuantity(editingMedication.current_quantity.toString());
        setLowStockThreshold(editingMedication.low_stock_threshold.toString());
      }
    }
  }, [editingMedication]);

  const addMedication = () => {
    const newId = (medications.length + 1).toString();
    setMedications([...medications, {
      id: newId,
      name: '',
      dosage: '',
      unit: 'mg',
      frequency: 'Once daily',
      notes: '',
      reminderMode: 'now',
      reminderOffset: 5,
      customHour: 8,
      customMinute: 0,
    }]);
  };

  const removeMedication = (id: string) => {
    if (medications.length === 1) {
      Alert.alert('Error', 'You must have at least one medication');
      return;
    }
    setMedications(medications.filter(m => m.id !== id));
  };

  const updateMedication = (id: string, updates: Partial<MedicationToAdd>) => {
    setMedications(medications.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  // ✅ NEW: Show frequency info modal
  const showFrequencyDetails = (frequency: string) => {
    const info = frequencies.find(f => f.value === frequency);
    if (info) {
      setSelectedFrequencyInfo(info);
      setShowFrequencyInfo(true);
    }
  };

  const calculateReminderTime = (med: MedicationToAdd): { hour: number; minute: number } => {
    if (med.reminderMode === 'custom') {
      return { hour: med.customHour, minute: med.customMinute };
    } else {
      const now = new Date();
      const futureTime = new Date(now.getTime() + med.reminderOffset * 60 * 1000);
      return { hour: futureTime.getHours(), minute: futureTime.getMinutes() };
    }
  };

  const handleSave = async () => {
    // Validation
    for (const med of medications) {
      if (!med.name.trim() || !med.dosage.trim()) {
        Alert.alert('Error', `Please fill in name and dosage for all medications`);
        return;
      }
    }

    if (trackInventory) {
      if (!totalQuantity.trim() || !currentQuantity.trim()) {
        Alert.alert('Error', 'Please enter quantity information');
        return;
      }

      const totalQty = parseInt(totalQuantity);
      const currentQty = parseInt(currentQuantity);
      const threshold = parseInt(lowStockThreshold);

      if (isNaN(totalQty) || isNaN(currentQty) || isNaN(threshold)) {
        Alert.alert('Error', 'Please enter valid numbers for quantities');
        return;
      }

      if (currentQty > totalQty) {
        Alert.alert('Error', 'Current quantity cannot be greater than total quantity');
        return;
      }
    }

    setLoading(true);

    try {
      const hasPermissions = await notificationService.requestPermissions();
      
      if (!hasPermissions) {
        Alert.alert(
          '⚠️ Permissions Required',
          'Please enable notifications in Settings to receive reminders.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      let successCount = 0;
      const errors: string[] = [];

      for (const med of medications) {
        try {
          const { hour, minute } = calculateReminderTime(med);
          const formattedTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;

          const medicationData: any = {
            medication_name: med.name.trim(),
            dosage: med.dosage.trim(),
            dosage_unit: med.unit,
            frequency: med.frequency,
            reminder_time: formattedTime,
            notes: med.notes.trim() || null,
            updated_at: new Date().toISOString(),
          };

          if (trackInventory) {
            medicationData.total_quantity = parseInt(totalQuantity);
            medicationData.current_quantity = parseInt(currentQuantity);
            medicationData.low_stock_threshold = parseInt(lowStockThreshold);
            medicationData.start_date = startDate.toISOString().split('T')[0];
            medicationData.expiry_date = expiryDate.toISOString().split('T')[0];
          } else {
            medicationData.total_quantity = 0;
            medicationData.current_quantity = 0;
            medicationData.low_stock_threshold = 0;
          }

          let medicationId: string;

          if (isEditing) {
            const { data, error } = await supabase
              .from('medications')
              .update(medicationData)
              .eq('id', editingMedication.id)
              .select()
              .single();

            if (error) throw error;
            medicationId = data.id;
            await notificationService.cancelMedicationNotifications(medicationId);
          } else {
            medicationData.user_id = CURRENT_USER_ID;
            medicationData.is_active = true;
            medicationData.created_at = new Date().toISOString();
            medicationData.start_date = new Date().toISOString().split('T')[0];

            const { data, error } = await supabase
              .from('medications')
              .insert(medicationData)
              .select()
              .single();

            if (error) throw error;
            medicationId = data.id;
          }

          const notificationId = await notificationService.scheduleMedicationReminder(
            medicationId,
            med.name.trim(),
            med.dosage.trim(),
            med.unit,
            hour,
            minute,
            med.notes.trim() || undefined,
            med.frequency
          );

          if (!notificationId) {
            throw new Error('Failed to schedule notification');
          }

          successCount++;
        } catch (error: any) {
          console.error(`Error saving ${med.name}:`, error);
          errors.push(`${med.name}: ${error.message}`);
        }
      }

      await new Promise(r => setTimeout(r, 500));

      if (successCount === medications.length) {
        Alert.alert(
          '✅ Success',
          isEditing
            ? 'Medication updated!'
            : `${successCount} medication${successCount > 1 ? 's' : ''} added successfully!`,
          [
            {
              text: 'OK',
              onPress: () => {
                resetForm();
                router.back();
              },
            },
          ]
        );
      } else {
        Alert.alert(
          '⚠️ Partial Success',
          `${successCount} saved, ${errors.length} failed:\n${errors.join('\n')}`,
          [
            {
              text: 'OK',
              onPress: () => {
                if (successCount > 0) {
                  resetForm();
                  router.back();
                }
              },
            },
          ]
        );
      }

    } catch (error: any) {
      Alert.alert('Error', `Failed to save: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMedications([{
      id: '1',
      name: '',
      dosage: '',
      unit: 'mg',
      frequency: 'Once daily',
      notes: '',
      reminderMode: 'now',
      reminderOffset: 5,
      customHour: 8,
      customMinute: 0,
    }]);
    setTrackInventory(false);
    setStartDate(new Date());
    setExpiryDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
    setTotalQuantity('30');
    setCurrentQuantity('30');
    setLowStockThreshold('5');
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

  const renderMedicationForm = (med: MedicationToAdd, index: number) => (
    <View key={med.id} style={styles.medicationFormContainer}>
      {isBulkMode && medications.length > 1 && (
        <View style={styles.medicationHeader}>
          <Text style={styles.medicationNumber}>Medication #{index + 1}</Text>
          <Pressable onPress={() => removeMedication(med.id)} style={styles.removeButton}>
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </Pressable>
        </View>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Medication Name *</Text>
        <TextInput
          style={styles.input}
          value={med.name}
          onChangeText={(text) => updateMedication(med.id, { name: text })}
          placeholder="e.g., Aspirin, Metformin"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="words"
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 2, marginRight: 8 }]}>
          <Text style={styles.label}>Dosage *</Text>
          <TextInput
            style={styles.input}
            value={med.dosage}
            onChangeText={(text) => updateMedication(med.id, { dosage: text })}
            placeholder="100"
            keyboardType="numeric"
            placeholderTextColor="#9CA3AF"
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>Unit</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {dosageUnits.slice(0, 3).map((unit) => (
              <Pressable
                key={unit}
                style={[
                  styles.unitButton,
                  med.unit === unit && styles.unitButtonActive
                ]}
                onPress={() => updateMedication(med.id, { unit })}
              >
                <Text style={[
                  styles.unitText,
                  med.unit === unit && styles.unitTextActive
                ]}>
                  {unit}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* ✅ IMPROVED: Frequency with info button */}
      <View style={styles.inputGroup}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Frequency</Text>
          <Pressable 
            style={styles.infoButton}
            onPress={() => showFrequencyDetails(med.frequency)}
          >
            <Ionicons name="information-circle" size={20} color="#6366F1" />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {frequencies.slice(0, 6).map((freq) => (
            <Pressable
              key={freq.value}
              style={[
                styles.frequencyButton,
                med.frequency === freq.value && styles.frequencyButtonActive
              ]}
              onPress={() => {
                updateMedication(med.id, { frequency: freq.value });
                showFrequencyDetails(freq.value);
              }}
            >
              <Text style={[
                styles.frequencyText,
                med.frequency === freq.value && styles.frequencyTextActive
              ]}>
                {freq.label}
              </Text>
              {freq.medicalTerm && (
                <Text style={[
                  styles.frequencySubtext,
                  med.frequency === freq.value && styles.frequencySubtextActive
                ]}>
                  {freq.medicalTerm.split('(')[0].trim()}
                </Text>
              )}
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Reminder Settings */}
      <View style={styles.reminderSection}>
        <Text style={styles.sectionTitle}>⏰ Reminder Settings</Text>
        
        <View style={styles.reminderModeContainer}>
          <Pressable
            style={[
              styles.reminderModeButton,
              med.reminderMode === 'now' && styles.reminderModeButtonActive
            ]}
            onPress={() => updateMedication(med.id, { reminderMode: 'now' })}
          >
            <Ionicons 
              name="time" 
              size={20} 
              color={med.reminderMode === 'now' ? '#6366F1' : '#6B7280'} 
            />
            <Text style={[
              styles.reminderModeText,
              med.reminderMode === 'now' && styles.reminderModeTextActive
            ]}>
              From Now
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.reminderModeButton,
              med.reminderMode === 'custom' && styles.reminderModeButtonActive
            ]}
            onPress={() => updateMedication(med.id, { reminderMode: 'custom' })}
          >
            <Ionicons 
              name="alarm" 
              size={20} 
              color={med.reminderMode === 'custom' ? '#6366F1' : '#6B7280'} 
            />
            <Text style={[
              styles.reminderModeText,
              med.reminderMode === 'custom' && styles.reminderModeTextActive
            ]}>
              Custom Time
            </Text>
          </Pressable>
        </View>

        {med.reminderMode === 'now' ? (
          <View style={styles.offsetContainer}>
            <Text style={styles.offsetLabel}>Remind me in:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {reminderOffsets.map((offset) => (
                <Pressable
                  key={offset.value}
                  style={[
                    styles.offsetButton,
                    med.reminderOffset === offset.value && styles.offsetButtonActive
                  ]}
                  onPress={() => updateMedication(med.id, { reminderOffset: offset.value })}
                >
                  <Text style={[
                    styles.offsetText,
                    med.reminderOffset === offset.value && styles.offsetTextActive
                  ]}>
                    {offset.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.helperText}>
              Based on your phone's current time
            </Text>
          </View>
        ) : (
          <View style={styles.customTimeContainer}>
            <Text style={styles.offsetLabel}>Set specific time:</Text>
            <View style={styles.timeInputContainer}>
              <TextInput
                style={[styles.input, styles.timeInput]}
                value={med.customHour.toString().padStart(2, '0')}
                onChangeText={(text) => {
                  const hour = parseInt(text) || 0;
                  if (hour >= 0 && hour <= 23) {
                    updateMedication(med.id, { customHour: hour });
                  }
                }}
                keyboardType="numeric"
                maxLength={2}
                placeholder="08"
              />
              <Text style={styles.timeSeparator}>:</Text>
              <TextInput
                style={[styles.input, styles.timeInput]}
                value={med.customMinute.toString().padStart(2, '0')}
                onChangeText={(text) => {
                  const minute = parseInt(text) || 0;
                  if (minute >= 0 && minute <= 59) {
                    updateMedication(med.id, { customMinute: minute });
                  }
                }}
                keyboardType="numeric"
                maxLength={2}
                placeholder="00"
              />
            </View>
            <Text style={styles.helperText}>24-hour format (0-23 hours)</Text>
          </View>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Notes (Optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={med.notes}
          onChangeText={(text) => updateMedication(med.id, { notes: text })}
          placeholder="Take with food, side effects, etc."
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />
      </View>

      {isBulkMode && index < medications.length - 1 && <View style={styles.divider} />}
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.header}>
        <View style={styles.headerContent}>
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="white" />
          </Pressable>
          <Text style={styles.title}>
            {isEditing ? 'Edit Medication' : `Add Medication${medications.length > 1 ? 's' : ''}`}
          </Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <View style={styles.tabContainer}>
        {renderTabButton('basic', 'Basic Info', 'information-circle')}
        {renderTabButton('inventory', 'Inventory', 'cube')}
      </View>

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
        {activeTab === 'basic' && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Medication Details</Text>
              {medications.map((med, index) => renderMedicationForm(med, index))}
              
              {isBulkMode && (
                <Pressable style={styles.addMoreButton} onPress={addMedication}>
                  <Ionicons name="add-circle-outline" size={24} color="#6366F1" />
                  <Text style={styles.addMoreText}>Add Another Medication</Text>
                </Pressable>
              )}
            </View>
          </>
        )}

        {activeTab === 'inventory' && (
          <>
            <View style={styles.section}>
              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.sectionTitle}>Track Inventory</Text>
                  <Text style={styles.helperText}>
                    {isBulkMode 
                      ? 'Applies to all medications above' 
                      : 'Monitor quantity and expiry dates'
                    }
                  </Text>
                </View>
                <Switch
                  value={trackInventory}
                  onValueChange={setTrackInventory}
                  trackColor={{ false: '#D1D5DB', true: '#6366F1' }}
                  thumbColor="white"
                />
              </View>
            </View>

            {trackInventory && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Quantity</Text>
                  
                  <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                      <Text style={styles.label}>Total *</Text>
                      <TextInput
                        style={styles.input}
                        value={totalQuantity}
                        onChangeText={setTotalQuantity}
                        placeholder="30"
                        keyboardType="numeric"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Current *</Text>
                      <TextInput
                        style={styles.input}
                        value={currentQuantity}
                        onChangeText={setCurrentQuantity}
                        placeholder="30"
                        keyboardType="numeric"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Low Stock Alert</Text>
                    <TextInput
                      style={styles.input}
                      value={lowStockThreshold}
                      onChangeText={setLowStockThreshold}
                      placeholder="5"
                      keyboardType="numeric"
                      placeholderTextColor="#9CA3AF"
                    />
                    <Text style={styles.helperText}>
                      Alert when {lowStockThreshold || '0'} or fewer remaining
                    </Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Dates</Text>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Start Date</Text>
                    <Pressable 
                      style={styles.dateButton}
                      onPress={() => setShowStartDatePicker(true)}
                    >
                      <Ionicons name="calendar-outline" size={20} color="#6366F1" />
                      <Text style={styles.dateText}>
                        {startDate.toLocaleDateString()}
                      </Text>
                    </Pressable>
                    {showStartDatePicker && (
                      <DateTimePicker
                        value={startDate}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                          setShowStartDatePicker(false);
                          if (selectedDate) setStartDate(selectedDate);
                        }}
                      />
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Expiry Date</Text>
                    <Pressable 
                      style={styles.dateButton}
                      onPress={() => setShowExpiryDatePicker(true)}
                    >
                      <Ionicons name="warning-outline" size={20} color="#F59E0B" />
                      <Text style={styles.dateText}>
                        {expiryDate.toLocaleDateString()}
                      </Text>
                    </Pressable>
                    {showExpiryDatePicker && (
                      <DateTimePicker
                        value={expiryDate}
                        mode="date"
                        display="default"
                        minimumDate={new Date()}
                        onChange={(event, selectedDate) => {
                          setShowExpiryDatePicker(false);
                          if (selectedDate) setExpiryDate(selectedDate);
                        }}
                      />
                    )}
                  </View>
                </View>
              </>
            )}
          </>
        )}

        <Pressable
          style={[styles.addButton, loading && styles.addButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <LinearGradient
            colors={loading ? ['#9CA3AF', '#6B7280'] : ['#10B981', '#059669']}
            style={styles.addButtonGradient}
          >
            {loading ? (
              <Ionicons name="refresh" size={24} color="white" />
            ) : (
              <>
                <Ionicons name={isEditing ? 'save' : 'add-circle'} size={24} color="white" />
                <Text style={styles.addButtonText}>
                  {isEditing ? 'Save Changes' : `Add ${medications.length} Medication${medications.length > 1 ? 's' : ''}`}
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ✅ NEW: Frequency Information Modal */}
      <Modal
        visible={showFrequencyInfo}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFrequencyInfo(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowFrequencyInfo(false)}
        >
          <Pressable style={styles.frequencyModal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.frequencyModalHeader}>
              <Ionicons name="information-circle" size={32} color="#6366F1" />
              <Pressable onPress={() => setShowFrequencyInfo(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </Pressable>
            </View>

            {selectedFrequencyInfo && (
              <View style={styles.frequencyModalContent}>
                <Text style={styles.frequencyModalTitle}>
                  {selectedFrequencyInfo.label}
                </Text>

                {selectedFrequencyInfo.medicalTerm && (
                  <View style={styles.medicalTermContainer}>
                    <Ionicons name="medical" size={16} color="#6366F1" />
                    <Text style={styles.medicalTerm}>
                      {selectedFrequencyInfo.medicalTerm}
                    </Text>
                  </View>
                )}

                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={20} color="#10B981" />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>Description</Text>
                    <Text style={styles.infoValue}>
                      {selectedFrequencyInfo.description}
                    </Text>
                  </View>
                </View>

                {selectedFrequencyInfo.interval > 0 && (
                  <View style={styles.infoRow}>
                    <Ionicons name="hourglass-outline" size={20} color="#F59E0B" />
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>Interval</Text>
                      <Text style={styles.infoValue}>
                        Every {selectedFrequencyInfo.interval} hours
                      </Text>
                    </View>
                  </View>
                )}

                {selectedFrequencyInfo.timesPerDay > 0 && (
                  <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={20} color="#8B5CF6" />
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>Frequency</Text>
                      <Text style={styles.infoValue}>
                        {selectedFrequencyInfo.timesPerDay} times per day
                      </Text>
                    </View>
                  </View>
                )}

                {selectedFrequencyInfo.examples && (
                  <View style={styles.examplesContainer}>
                    <Ionicons name="bulb-outline" size={20} color="#EAB308" />
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoLabel}>Example Schedule</Text>
                      <Text style={styles.exampleText}>
                        {selectedFrequencyInfo.examples}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.calculationBox}>
                  <Text style={styles.calculationTitle}>💡 How to Calculate</Text>
                  {selectedFrequencyInfo.interval > 0 ? (
                    <Text style={styles.calculationText}>
                      24 hours ÷ {selectedFrequencyInfo.interval} hours = {selectedFrequencyInfo.timesPerDay} doses per day
                    </Text>
                  ) : (
                    <Text style={styles.calculationText}>
                      {selectedFrequencyInfo.description}
                    </Text>
                  )}
                </View>
              </View>
            )}

            <Pressable 
              style={styles.closeModalButton}
              onPress={() => setShowFrequencyInfo(false)}
            >
              <Text style={styles.closeModalText}>Got it!</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  closeButton: { padding: 4 },
  title: { fontSize: 20, fontWeight: '700', color: 'white' },
  tabContainer: { flexDirection: 'row', backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8, backgroundColor: '#F9FAFB', gap: 6 },
  tabButtonActive: { backgroundColor: '#EEF2FF' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#6366F1' },
  form: { flex: 1 },
  section: { padding: 20, backgroundColor: 'white', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 16 },
  
  medicationFormContainer: { marginBottom: 16 },
  medicationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#6366F1' },
  medicationNumber: { fontSize: 16, fontWeight: '700', color: '#6366F1' },
  removeButton: { padding: 8, borderRadius: 8, backgroundColor: '#FEE2E2' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  addMoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderWidth: 2, borderColor: '#6366F1', borderStyle: 'dashed', borderRadius: 12, backgroundColor: '#F8FAFC', marginTop: 16, gap: 8 },
  addMoreText: { fontSize: 16, fontWeight: '600', color: '#6366F1' },
  
  reminderSection: { backgroundColor: '#F9FAFB', padding: 16, borderRadius: 12, marginBottom: 16 },
  reminderModeContainer: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  reminderModeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E5E7EB', gap: 6 },
  reminderModeButtonActive: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  reminderModeText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  reminderModeTextActive: { color: '#6366F1' },
  offsetContainer: { gap: 8 },
  offsetLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  offsetButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFFFFF', marginRight: 8, borderWidth: 1, borderColor: '#D1D5DB' },
  offsetButtonActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  offsetText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  offsetTextActive: { color: 'white' },
  customTimeContainer: { gap: 8 },
  timeInputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  timeInput: { width: 70, textAlign: 'center' },
  timeSeparator: { fontSize: 24, fontWeight: 'bold', color: '#374151', marginHorizontal: 8 },
  
  inputGroup: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },
  infoButton: { padding: 4 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 16, fontSize: 16, backgroundColor: '#F9FAFB', color: '#374151' },
  helperText: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  row: { flexDirection: 'row' },
  unitButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F3F4F6', marginRight: 8 },
  unitButtonActive: { backgroundColor: '#6366F1' },
  unitText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  unitTextActive: { color: 'white' },
  frequencyButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6', marginRight: 8, minWidth: 100 },
  frequencyButtonActive: { backgroundColor: '#6366F1' },
  frequencyText: { fontSize: 14, color: '#6B7280', fontWeight: '600', textAlign: 'center' },
  frequencyTextActive: { color: 'white' },
  frequencySubtext: { fontSize: 11, color: '#9CA3AF', marginTop: 2, textAlign: 'center' },
  frequencySubtextActive: { color: '#E0E7FF' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateButton: { flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, backgroundColor: '#F9FAFB' },
  dateText: { fontSize: 16, color: '#374151', marginLeft: 12, fontWeight: '500' },
  notesInput: { height: 60, textAlignVertical: 'top' },
  addButton: { marginHorizontal: 20, marginTop: 8, borderRadius: 12, overflow: 'hidden' },
  addButtonDisabled: { opacity: 0.6 },
  addButtonGradient: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, gap: 8 },
  addButtonText: { color: 'white', fontSize: 18, fontWeight: '700' },

  // ✅ NEW: Frequency modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  frequencyModal: { backgroundColor: 'white', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, maxHeight: '80%' },
  frequencyModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  frequencyModalContent: { gap: 16 },
  frequencyModalTitle: { fontSize: 24, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  medicalTermContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', padding: 12, borderRadius: 8, gap: 8 },
  medicalTerm: { fontSize: 14, fontWeight: '600', color: '#6366F1' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, gap: 12 },
  infoTextContainer: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  infoValue: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  examplesContainer: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFFBEB', padding: 12, borderRadius: 8, gap: 12 },
  exampleText: { fontSize: 14, color: '#92400E', fontStyle: 'italic' },
  calculationBox: { backgroundColor: '#EEF2FF', padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#C7D2FE' },
  calculationTitle: { fontSize: 16, fontWeight: '700', color: '#4F46E5', marginBottom: 8 },
  calculationText: { fontSize: 14, color: '#6366F1', lineHeight: 20 },
  closeModalButton: { backgroundColor: '#6366F1', padding: 16, borderRadius: 12, marginTop: 20, alignItems: 'center' },
  closeModalText: { fontSize: 16, fontWeight: '700', color: 'white' },
});