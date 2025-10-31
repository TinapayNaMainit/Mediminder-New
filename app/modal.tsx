// app/modal.tsx - FIXED ALL ISSUES
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  Pressable,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notificationService';
import { smartReminderService } from '../services/smartReminderService';
import { safetyService } from '../services/medicationEnhancedService';

type TabType = 'basic' | 'inventory' | 'safety';

interface MedicationToAdd {
  id: string;
  name: string;
  dosage: string;
  unit: string;
  frequency: string;
  notes: string;
  // ✅ FIX 5 & 6: Individual inventory and expiry per medication
  totalQuantity: string;
  currentQuantity: string;
  lowStockThreshold: string;
  expiryDate: Date;
  // ✅ FIX 3: Track start time per medication
  startTime: Date;
}

export default function BulkAddMedicationModal() {
  const { user } = useAuth();
  const CURRENT_USER_ID = user?.id;

  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [loading, setLoading] = useState(false);

  // ✅ FIX 3: Initialize with current time instead of fixed time
  const getCurrentTime = () => new Date();

  const [medications, setMedications] = useState<MedicationToAdd[]>([
    {
      id: '1',
      name: '',
      dosage: '',
      unit: 'mg',
      frequency: 'Every 8 hours', // ✅ FIX 2: New default
      notes: '',
      totalQuantity: '', // ✅ FIX 5: Empty by default
      currentQuantity: '', // ✅ FIX 5: Empty by default
      lowStockThreshold: '5',
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // ✅ FIX 6: Per medication
      startTime: getCurrentTime(), // ✅ FIX 3: Current time
    }
  ]);

  // Shared settings
  const [advanceMinutes, setAdvanceMinutes] = useState(5);
  const [allergies, setAllergies] = useState('');
  const [checkInteractions, setCheckInteractions] = useState(true);
  const [showExpiryDatePicker, setShowExpiryDatePicker] = useState<string | null>(null);
  const [showStartTimePicker, setShowStartTimePicker] = useState<string | null>(null);

  const dosageUnits = ['mg', 'g', 'mcg', 'ml', 'tablets', 'capsules', 'drops', 'puffs'];
  
  // ✅ FIX 2: Updated frequency options
  const frequencies = [
    { label: 'Every 4hrs', value: 'Every 4 hours', icon: '⏰' },
    { label: 'Every 6hrs', value: 'Every 6 hours', icon: '⏰' },
    { label: 'Every 8hrs', value: 'Every 8 hours', icon: '⏰' },
    { label: 'Every 12hrs', value: 'Every 12 hours', icon: '⏰' },
    { label: 'Custom', value: 'Custom', icon: '⚙️' },
  ];

  const advanceReminderOptions = [
    { label: 'On time', value: 0, icon: '⏱️' },
    { label: '3 min', value: 3, icon: '🔔' },
    { label: '5 min', value: 5, icon: '🔔' },
    { label: '10 min', value: 10, icon: '🔔' },
    { label: '15 min', value: 15, icon: '🔔' },
    { label: '30 min', value: 30, icon: '🔔' },
  ];

  // ✅ FIX 4: Add medication function
  const addMedication = () => {
    const newId = (medications.length + 1).toString();
    setMedications([...medications, {
      id: newId,
      name: '',
      dosage: '',
      unit: 'mg',
      frequency: 'Every 8 hours',
      notes: '',
      totalQuantity: '',
      currentQuantity: '',
      lowStockThreshold: '5',
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      startTime: getCurrentTime(), // ✅ FIX 3: Current time for new meds
    }]);
  };

  const removeMedication = (id: string) => {
    if (medications.length === 1) {
      Alert.alert('Notice', 'You must have at least one medication');
      return;
    }
    setMedications(medications.filter(m => m.id !== id));
  };

  const updateMedication = (id: string, updates: Partial<MedicationToAdd>) => {
    setMedications(medications.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const handleSave = async () => {
    // Validate all medications
    for (const med of medications) {
      if (!med.name.trim() || !med.dosage.trim()) {
        Alert.alert('Error', `Please fill in name and dosage for all medications`);
        return;
      }

      // ✅ FIX 5: Validate quantities if provided
      if (med.totalQuantity || med.currentQuantity) {
        const totalQty = parseInt(med.totalQuantity);
        const currentQty = parseInt(med.currentQuantity);

        if (isNaN(totalQty) || isNaN(currentQty)) {
          Alert.alert('Error', `Please enter valid quantities for ${med.name}`);
          return;
        }

        if (currentQty > totalQty) {
          Alert.alert('Error', `Current quantity cannot exceed total quantity for ${med.name}`);
          return;
        }
      }
    }

    if (!CURRENT_USER_ID) {
      Alert.alert('Error', 'User not found');
      return;
    }

    setLoading(true);

    try {
      // Check allergies
      for (const med of medications) {
        const hasAllergy = await safetyService.checkAllergies(CURRENT_USER_ID, med.name);
        if (hasAllergy) {
          const proceed = await new Promise((resolve) => {
            Alert.alert(
              'Allergy Warning',
              `Allergy detected for ${med.name}. Continue?`,
              [
                { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
                { text: 'Continue', onPress: () => resolve(true) }
              ]
            );
          });
          if (!proceed) {
            setLoading(false);
            return;
          }
        }
      }

      const hasPermissions = await notificationService.requestPermissions();
      if (!hasPermissions) {
        Alert.alert('⚠️ Permissions Required', 'Please enable notifications.');
        setLoading(false);
        return;
      }

      let successCount = 0;
      const errors: string[] = [];

      // Save each medication
      for (const med of medications) {
        try {
          // ✅ FIX 3: Use medication's start time
          const startHour = med.startTime.getHours();
          const startMinute = med.startTime.getMinutes();
          const startTimeStr = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;
          
          // Get schedule with start time
          const schedule = smartReminderService.getScheduleForFrequency(med.frequency, startTimeStr);
          
          // Use first scheduled time
          const primaryTime = schedule.times[0] || startTimeStr;
          const { hour, minute } = smartReminderService.calculateReminderTime(primaryTime, advanceMinutes);
          const formattedTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

          const medicationData: any = {
            user_id: CURRENT_USER_ID,
            medication_name: med.name.trim(),
            dosage: med.dosage.trim(),
            dosage_unit: med.unit,
            frequency: med.frequency,
            reminder_time: formattedTime,
            advance_reminder_minutes: advanceMinutes,
            notes: med.notes.trim() || null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            start_date: med.startTime.toISOString().split('T')[0], // ✅ FIX 3: Use start time
            expiry_date: med.expiryDate.toISOString().split('T')[0], // ✅ FIX 6: Per medication
          };

          // ✅ FIX 5: Only add quantities if provided
          if (med.totalQuantity && med.currentQuantity) {
            medicationData.total_quantity = parseInt(med.totalQuantity);
            medicationData.current_quantity = parseInt(med.currentQuantity);
            medicationData.low_stock_threshold = parseInt(med.lowStockThreshold);
          } else {
            medicationData.total_quantity = 0;
            medicationData.current_quantity = 0;
            medicationData.low_stock_threshold = 0;
          }

          const { data: newMedication, error } = await supabase
            .from('medications')
            .insert(medicationData)
            .select()
            .single();

          if (error) throw error;

          const notificationIds = await smartReminderService.scheduleSmartReminders(
            newMedication.id,
            med.name.trim(),
            med.dosage.trim(),
            med.unit,
            med.frequency,
            advanceMinutes,
            med.notes.trim() || undefined
          );

          if (notificationIds.length === 0 && med.frequency !== 'As needed') {
            throw new Error('Failed to schedule notifications');
          }

          successCount++;
        } catch (error: any) {
          console.error(`Error saving ${med.name}:`, error);
          errors.push(`${med.name}: ${error.message}`);
        }
      }

      // Check drug interactions
      if (checkInteractions && successCount > 0) {
        setTimeout(async () => {
          await safetyService.showSafetyWarnings(CURRENT_USER_ID);
        }, 1000);
      }

      // Save allergies
      if (allergies.trim()) {
        await supabase
          .from('user_profiles')
          .update({ allergies: allergies.trim() })
          .eq('user_id', CURRENT_USER_ID);
      }

      // Show results
      if (successCount === medications.length) {
        Alert.alert(
          '✅ Success',
          `${successCount} medication${successCount > 1 ? 's' : ''} added successfully!`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else if (successCount > 0) {
        Alert.alert(
          '⚠️ Partial Success',
          `${successCount} saved, ${errors.length} failed:\n${errors.join('\n')}`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Error', `Failed to save medications:\n${errors.join('\n')}`);
      }
    } catch (error: any) {
      console.error('Error saving medications:', error);
      Alert.alert('Error', `Failed to save: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
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

  if (!CURRENT_USER_ID) return null;

  const schedulePreview = smartReminderService.getScheduleDescription(medications[0].frequency, advanceMinutes);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.header}>
        <View style={styles.headerContent}>
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="white" />
          </Pressable>
          <Text style={styles.title}>
            Add Medication{medications.length > 1 ? 's' : ''}
          </Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <View style={styles.tabContainer}>
        {renderTabButton('basic', 'Basic Info', 'information-circle')}
        {renderTabButton('inventory', 'Inventory', 'cube')}
        {renderTabButton('safety', 'Safety', 'shield-checkmark')}
      </View>

      <ScrollView 
        style={styles.form} 
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        contentContainerStyle={styles.scrollContent}
      >
        {activeTab === 'basic' && (
          <View style={styles.section}>
            {medications.map((med, index) => (
              <View key={med.id} style={styles.medicationBlock}>
                {medications.length > 1 && (
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
                    {/* ✅ FIX 1: Dynamic dosage label */}
                    <Text style={styles.label}>
                      {med.name.trim() ? `Dosage for ${med.name} *` : 'Dosage *'}
                    </Text>
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
                          style={[styles.unitButton, med.unit === unit && styles.unitButtonActive]}
                          onPress={() => updateMedication(med.id, { unit })}
                        >
                          <Text style={[styles.unitText, med.unit === unit && styles.unitTextActive]}>
                            {unit}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                {/* ✅ FIX 2: Updated frequency options */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>How often? *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {frequencies.map((freq) => (
                      <Pressable
                        key={freq.value}
                        style={[styles.frequencyButton, med.frequency === freq.value && styles.frequencyButtonActive]}
                        onPress={() => updateMedication(med.id, { frequency: freq.value })}
                      >
                        <Text style={styles.frequencyIcon}>{freq.icon}</Text>
                        <Text style={[styles.frequencyText, med.frequency === freq.value && styles.frequencyTextActive]}>
                          {freq.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* ✅ FIX 3: Start time picker per medication */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Start Time *</Text>
                  <Pressable
                    style={styles.timeButton}
                    onPress={() => setShowStartTimePicker(med.id)}
                  >
                    <Ionicons name="time-outline" size={20} color="#6366F1" />
                    <Text style={styles.timeText}>
                      {med.startTime.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </Text>
                  </Pressable>
                  {showStartTimePicker === med.id && (
                    <DateTimePicker
                      value={med.startTime}
                      mode="time"
                      display="default"
                      onChange={(event, date) => {
                        setShowStartTimePicker(null);
                        if (date) {
                          updateMedication(med.id, { startTime: date });
                        }
                      }}
                    />
                  )}
                  <Text style={styles.helperText}>
                    Medication tracking will start from this time
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Notes (Optional)</Text>
                  <TextInput
                    style={[styles.input, styles.notesInput]}
                    value={med.notes}
                    onChangeText={(text) => updateMedication(med.id, { notes: text })}
                    placeholder="Take with food, etc."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={2}
                    textAlignVertical="top"
                  />
                </View>

                {index < medications.length - 1 && <View style={styles.divider} />}
              </View>
            ))}

            {/* Shared Reminder Settings */}
            <View style={styles.sharedSection}>
              <Text style={styles.sharedSectionTitle}>⏰ Reminder Settings (applies to all)</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Remind me...</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {advanceReminderOptions.map((option) => (
                    <Pressable
                      key={option.value}
                      style={[styles.advanceButton, advanceMinutes === option.value && styles.advanceButtonActive]}
                      onPress={() => setAdvanceMinutes(option.value)}
                    >
                      <Text style={styles.advanceIcon}>{option.icon}</Text>
                      <Text style={[styles.advanceText, advanceMinutes === option.value && styles.advanceTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={styles.helperText}>
                  {advanceMinutes > 0 ? `${advanceMinutes} minutes before scheduled time` : 'Exactly at scheduled time'}
                </Text>
              </View>

              <View style={styles.schedulePreview}>
                <Ionicons name="calendar-outline" size={20} color="#6366F1" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.scheduleTitle}>Example Schedule</Text>
                  <Text style={styles.scheduleText}>{schedulePreview}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'inventory' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📦 Inventory Tracking (Optional)</Text>
            <Text style={styles.sectionSubtitle}>
              Track pill counts and get refill alerts. Leave blank to skip.
            </Text>

            {medications.map((med, index) => (
              <View key={med.id} style={styles.inventoryBlock}>
                <Text style={styles.inventoryMedName}>
                  {med.name || `Medication #${index + 1}`}
                </Text>

                {/* ✅ FIX 6: Expiry date per medication */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Expiry Date</Text>
                  <Pressable
                    style={styles.dateButton}
                    onPress={() => setShowExpiryDatePicker(med.id)}
                  >
                    <Ionicons name="warning-outline" size={20} color="#F59E0B" />
                    <Text style={styles.dateText}>
                      {med.expiryDate.toLocaleDateString()}
                    </Text>
                  </Pressable>
                  {showExpiryDatePicker === med.id && (
                    <DateTimePicker
                      value={med.expiryDate}
                      mode="date"
                      display="default"
                      minimumDate={new Date()}
                      onChange={(event, date) => {
                        setShowExpiryDatePicker(null);
                        if (date) {
                          updateMedication(med.id, { expiryDate: date });
                        }
                      }}
                    />
                  )}
                </View>

                {/* ✅ FIX 5: Editable quantities per medication */}
                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.label}>Total Quantity</Text>
                    <TextInput
                      style={styles.input}
                      value={med.totalQuantity}
                      onChangeText={(text) => updateMedication(med.id, { totalQuantity: text })}
                      placeholder="e.g., 30"
                      keyboardType="numeric"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Current</Text>
                    <TextInput
                      style={styles.input}
                      value={med.currentQuantity}
                      onChangeText={(text) => updateMedication(med.id, { currentQuantity: text })}
                      placeholder="e.g., 30"
                      keyboardType="numeric"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Low Stock Alert Threshold</Text>
                  <TextInput
                    style={styles.input}
                    value={med.lowStockThreshold}
                    onChangeText={(text) => updateMedication(med.id, { lowStockThreshold: text })}
                    placeholder="5"
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text style={styles.helperText}>
                    Alert when {med.lowStockThreshold || '0'} or fewer remaining
                  </Text>
                </View>

                {index < medications.length - 1 && <View style={styles.divider} />}
              </View>
            ))}

            <Text style={styles.note}>
              💡 Leave quantities blank if you don't want to track inventory
            </Text>
          </View>
        )}

        {activeTab === 'safety' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🛡️ Safety Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Known Allergies</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={allergies}
                onChangeText={setAllergies}
                placeholder="e.g., Penicillin, Sulfa drugs, Latex"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
              <Text style={styles.helperText}>
                Separate multiple allergies with commas
              </Text>
            </View>

            <View style={styles.toggleSection}>
              <View style={styles.toggleContent}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Drug Interaction Check</Text>
                  <Text style={styles.toggleDescription}>
                    Check for interactions automatically
                  </Text>
                </View>
                <Switch
                  value={checkInteractions}
                  onValueChange={setCheckInteractions}
                  trackColor={{ false: '#D1D5DB', true: '#6366F1' }}
                  thumbColor="white"
                />
              </View>
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={24} color="#6366F1" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.infoTitle}>Safety Features</Text>
                <Text style={styles.infoText}>
                  • Allergy detection alerts{'\n'}
                  • Drug interaction warnings{'\n'}
                  • Expiration date tracking{'\n'}
                  • Proper disposal guidance{'\n'}
                  • Low stock notifications
                </Text>
              </View>
            </View>

            <View style={styles.warningBox}>
              <Ionicons name="warning" size={24} color="#F59E0B" />
              <Text style={styles.warningText}>
                These safety checks are informational only. Always consult your doctor or pharmacist.
              </Text>
            </View>
          </View>
        )}

        <Pressable
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <LinearGradient
            colors={loading ? ['#9CA3AF', '#6B7280'] : ['#10B981', '#059669']}
            style={styles.saveButtonGradient}
          >
            {loading ? (
              <Ionicons name="refresh" size={24} color="white" />
            ) : (
              <>
                <Ionicons name="add-circle" size={24} color="white" />
                <Text style={styles.saveButtonText}>
                  Add {medications.length} Medication{medications.length > 1 ? 's' : ''}
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        {/* Extra padding for FAB */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ✅ FIX 4: FAB always visible */}
      <Pressable style={styles.fab} onPress={addMedication}>
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={28} color="white" />
        </LinearGradient>
      </Pressable>
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
  scrollContent: { paddingBottom: 100 },
  section: { padding: 20, backgroundColor: 'white', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  sectionSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 16, lineHeight: 20 },
  
  medicationBlock: { marginBottom: 24 },
  medicationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#6366F1' },
  medicationNumber: { fontSize: 16, fontWeight: '700', color: '#6366F1' },
  removeButton: { padding: 8, borderRadius: 8, backgroundColor: '#FEE2E2' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 24 },
  
  sharedSection: { backgroundColor: '#F9FAFB', padding: 16, borderRadius: 12, marginTop: 8 },
  sharedSectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 16 },
  
  inventoryBlock: { backgroundColor: '#F9FAFB', padding: 16, borderRadius: 12, marginBottom: 16 },
  inventoryMedName: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 16 },
  
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 16, fontSize: 16, backgroundColor: 'white', color: '#374151' },
  helperText: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  row: { flexDirection: 'row' },
  unitButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F3F4F6', marginRight: 8 },
  unitButtonActive: { backgroundColor: '#6366F1' },
  unitText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  unitTextActive: { color: 'white' },
  frequencyButton: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6', marginRight: 8, minWidth: 90, alignItems: 'center' },
  frequencyButtonActive: { backgroundColor: '#6366F1' },
  frequencyIcon: { fontSize: 18, marginBottom: 4 },
  frequencyText: { fontSize: 12, color: '#6B7280', fontWeight: '600', textAlign: 'center' },
  frequencyTextActive: { color: 'white' },
  advanceButton: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F3F4F6', marginRight: 8, minWidth: 70, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  advanceButtonActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  advanceIcon: { fontSize: 16, marginBottom: 2 },
  advanceText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  advanceTextActive: { color: 'white' },
  schedulePreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#C7D2FE' },
  scheduleTitle: { fontSize: 14, fontWeight: '700', color: '#6366F1', marginBottom: 4 },
  scheduleText: { fontSize: 13, color: '#4F46E5' },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  
  timeButton: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB', gap: 12 },
  timeText: { fontSize: 16, color: '#374151', fontWeight: '600' },
  
  dateButton: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB', gap: 12 },
  dateText: { fontSize: 16, color: '#374151', fontWeight: '600' },
  
  toggleSection: { marginBottom: 16 },
  toggleContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9FAFB', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB' },
  toggleTextContainer: { flex: 1, marginRight: 12 },
  toggleTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  toggleDescription: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#EEF2FF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#C7D2FE', marginBottom: 16 },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#4F46E5', marginBottom: 8 },
  infoText: { fontSize: 13, color: '#4F46E5', lineHeight: 20 },
  
  warningBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FEF3C7', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FCD34D', gap: 12 },
  warningText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 20 },
  
  note: { fontSize: 12, color: '#6B7280', fontStyle: 'italic', textAlign: 'center', marginTop: 12 },
  
  saveButton: { marginHorizontal: 20, marginVertical: 16, borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 12 },
  saveButtonText: { fontSize: 18, fontWeight: '700', color: 'white' },
  
  fab: { position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  fabGradient: { width: '100%', height: '100%', borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
});