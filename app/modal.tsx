// app/modal.tsx - FIXED with Bulk Add + Centered Toggle
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
}

export default function BulkAddMedicationModal() {
  const { user } = useAuth();
  const CURRENT_USER_ID = user?.id;

  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [loading, setLoading] = useState(false);

  // ✅ NEW: Multiple medications support
  const [medications, setMedications] = useState<MedicationToAdd[]>([
    {
      id: '1',
      name: '',
      dosage: '',
      unit: 'mg',
      frequency: 'Once daily',
      notes: '',
    }
  ]);

  // ✅ Shared settings (apply to all medications)
  const [advanceMinutes, setAdvanceMinutes] = useState(5);
  const [expiryDate, setExpiryDate] = useState(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
  const [showExpiryDatePicker, setShowExpiryDatePicker] = useState(false);
  const [trackInventory, setTrackInventory] = useState(true);
  const [totalQuantity, setTotalQuantity] = useState('30');
  const [currentQuantity, setCurrentQuantity] = useState('30');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [startDate, setStartDate] = useState(new Date());
  const [allergies, setAllergies] = useState('');
  const [checkInteractions, setCheckInteractions] = useState(true);

  const dosageUnits = ['mg', 'g', 'mcg', 'ml', 'tablets', 'capsules', 'drops', 'puffs'];
  
  const frequencies = [
    { label: 'Once daily', value: 'Once daily', icon: '1️⃣' },
    { label: 'Twice daily', value: 'Twice daily', icon: '2️⃣' },
    { label: 'Three times', value: 'Three times daily', icon: '3️⃣' },
    { label: 'Four times', value: 'Four times daily', icon: '4️⃣' },
    { label: 'Every 4hr', value: 'Every 4 hours', icon: '⏰' },
    { label: 'Every 6hr', value: 'Every 6 hours', icon: '⏰' },
  ];

  const advanceReminderOptions = [
    { label: 'On time', value: 0, icon: '⏱️' },
    { label: '3 min', value: 3, icon: '🔔' },
    { label: '5 min', value: 5, icon: '🔔' },
    { label: '10 min', value: 10, icon: '🔔' },
    { label: '15 min', value: 15, icon: '🔔' },
    { label: '30 min', value: 30, icon: '🔔' },
  ];

  // ✅ NEW: Add another medication
  const addMedication = () => {
    const newId = (medications.length + 1).toString();
    setMedications([...medications, {
      id: newId,
      name: '',
      dosage: '',
      unit: 'mg',
      frequency: 'Once daily',
      notes: '',
    }]);
  };

  // ✅ NEW: Remove medication
  const removeMedication = (id: string) => {
    if (medications.length === 1) {
      Alert.alert('Notice', 'You must have at least one medication');
      return;
    }
    setMedications(medications.filter(m => m.id !== id));
  };

  // ✅ NEW: Update specific medication
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
    }

    if (!CURRENT_USER_ID) {
      Alert.alert('Error', 'User not found');
      return;
    }

    setLoading(true);

    try {
      // Check allergies for all medications
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

      // Validate inventory if enabled
      if (trackInventory) {
        const totalQty = parseInt(totalQuantity);
        const currentQty = parseInt(currentQuantity);
        const threshold = parseInt(lowStockThreshold);

        if (isNaN(totalQty) || isNaN(currentQty) || isNaN(threshold)) {
          Alert.alert('Error', 'Please enter valid numbers for quantities');
          setLoading(false);
          return;
        }

        if (currentQty > totalQty) {
          Alert.alert('Error', 'Current quantity cannot exceed total quantity');
          setLoading(false);
          return;
        }
      }

      let successCount = 0;
      const errors: string[] = [];

      // ✅ Save each medication
      for (const med of medications) {
        try {
          const schedule = smartReminderService.getScheduleForFrequency(med.frequency);
          const primaryTime = schedule.times[0] || '08:00';
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
            start_date: startDate.toISOString().split('T')[0],
            expiry_date: expiryDate.toISOString().split('T')[0],
          };

          if (trackInventory) {
            medicationData.total_quantity = parseInt(totalQuantity);
            medicationData.current_quantity = parseInt(currentQuantity);
            medicationData.low_stock_threshold = parseInt(lowStockThreshold);
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

      <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
        {activeTab === 'basic' && (
          <View style={styles.section}>
            {/* ✅ RENDER EACH MEDICATION */}
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

            {/* ✅ ADD MORE BUTTON */}
            <Pressable style={styles.addMoreButton} onPress={addMedication}>
              <Ionicons name="add-circle-outline" size={24} color="#6366F1" />
              <Text style={styles.addMoreText}>Add Another Medication</Text>
            </Pressable>

            {/* ✅ SHARED REMINDER SETTINGS */}
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
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Expiry Date *</Text>
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowExpiryDatePicker(true)}
              >
                <Ionicons name="warning-outline" size={20} color="#F59E0B" />
                <Text style={styles.dateText}>{expiryDate.toLocaleDateString()}</Text>
              </Pressable>
              {showExpiryDatePicker && (
                <DateTimePicker
                  value={expiryDate}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(event, date) => {
                    setShowExpiryDatePicker(false);
                    if (date) setExpiryDate(date);
                  }}
                />
              )}
            </View>

            {/* ✅ FIXED: Centered Toggle */}
            <View style={styles.toggleSection}>
              <View style={styles.toggleContent}>
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleTitle}>Track Inventory</Text>
                  <Text style={styles.toggleDescription}>
                    Monitor pill count and get refill alerts
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
                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.label}>Total Quantity *</Text>
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
                  <Text style={styles.label}>Low Stock Alert Threshold</Text>
                  <TextInput
                    style={styles.input}
                    value={lowStockThreshold}
                    onChangeText={setLowStockThreshold}
                    placeholder="5"
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text style={styles.helperText}>
                    Alert when {lowStockThreshold || '0'} or fewer pills remaining
                  </Text>
                </View>

                <Text style={styles.note}>
                  📦 Inventory settings apply to all medications above
                </Text>
              </>
            )}
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

            {/* ✅ FIXED: Centered Toggle */}
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

        <View style={{ height: 40 }} />
      </ScrollView>
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
  
  // ✅ NEW: Medication block styles
  medicationBlock: { marginBottom: 24 },
  medicationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#6366F1' },
  medicationNumber: { fontSize: 16, fontWeight: '700', color: '#6366F1' },
  removeButton: { padding: 8, borderRadius: 8, backgroundColor: '#FEE2E2' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 24 },
  addMoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderWidth: 2, borderColor: '#6366F1', borderStyle: 'dashed', borderRadius: 12, backgroundColor: '#F8FAFC', marginBottom: 24, gap: 8 },
  addMoreText: { fontSize: 16, fontWeight: '600', color: '#6366F1' },
  
  sharedSection: { backgroundColor: '#F9FAFB', padding: 16, borderRadius: 12, marginTop: 8 },
  sharedSectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 16 },
  
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
  scheduleText: { fontSize: 13, color: '#4B5563', lineHeight: 18 },
  notesInput: { height: 80, paddingTop: 12 },
  dateButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 16, backgroundColor: 'white', gap: 12 },
  dateText: { fontSize: 16, color: '#374151', fontWeight: '500' },
  
  // ✅ FIXED: Centered toggle styles
  toggleSection: { marginBottom: 16, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16 },
  toggleContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleTextContainer: { flex: 1, marginRight: 12 },
  toggleTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  toggleDescription: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  
  note: { fontSize: 13, color: '#6B7280', fontStyle: 'italic', marginTop: 12, textAlign: 'center' },
  infoBox: { flexDirection: 'row', backgroundColor: '#EEF2FF', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#C7D2FE' },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#6366F1', marginBottom: 8 },
  infoText: { fontSize: 13, color: '#4B5563', lineHeight: 20 },
  warningBox: { flexDirection: 'row', backgroundColor: '#FEF3C7', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A', gap: 12 },
  warningText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },
  saveButton: { marginHorizontal: 20, marginTop: 20, borderRadius: 16, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 8 },
  saveButtonText: { fontSize: 18, fontWeight: '700', color: 'white' },
});