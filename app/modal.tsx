// app/modal.tsx - PRODUCTION READY
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
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notificationService';

type TabType = 'basic' | 'inventory';

export default function AddOrEditMedicationModal() {
  const params = useLocalSearchParams();
  const editingMedication = params?.medication ? JSON.parse(params.medication as string) : null;
  const isEditing = !!editingMedication;

  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [medicationName, setMedicationName] = useState(editingMedication?.medication_name || '');
  const [dosage, setDosage] = useState(editingMedication?.dosage || '');
  const [dosageUnit, setDosageUnit] = useState(editingMedication?.dosage_unit || 'mg');
  const [frequency, setFrequency] = useState(editingMedication?.frequency || 'Once daily');
  const [notes, setNotes] = useState(editingMedication?.notes || '');
  const [reminderHour, setReminderHour] = useState('8');
  const [reminderMinute, setReminderMinute] = useState('00');
  const [use24HourFormat, setUse24HourFormat] = useState(true);
  const [amPm, setAmPm] = useState<'AM' | 'PM'>('AM');
  const [loading, setLoading] = useState(false);

  const [trackInventory, setTrackInventory] = useState(editingMedication?.total_quantity > 0);
  const [startDate, setStartDate] = useState(
    editingMedication?.start_date ? new Date(editingMedication.start_date) : new Date()
  );
  const [expiryDate, setExpiryDate] = useState(
    editingMedication?.expiry_date ? new Date(editingMedication.expiry_date) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  );
  const [totalQuantity, setTotalQuantity] = useState(editingMedication?.total_quantity?.toString() || '');
  const [currentQuantity, setCurrentQuantity] = useState(editingMedication?.current_quantity?.toString() || '');
  const [lowStockThreshold, setLowStockThreshold] = useState(editingMedication?.low_stock_threshold?.toString() || '5');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showExpiryDatePicker, setShowExpiryDatePicker] = useState(false);

  const { user } = useAuth();
  const CURRENT_USER_ID = user?.id;

  if (!CURRENT_USER_ID) return null;

  const dosageUnits = ['mg', 'g', 'mcg', 'ml', 'tablets', 'capsules', 'drops', 'puffs'];
  const frequencies = ['Once daily', 'Twice daily', 'Three times daily', 'Every 6 hours', 'Every 8 hours', 'Every 12 hours', 'As needed', 'Weekly'];

  useEffect(() => {
    if (editingMedication?.reminder_time) {
      const [hour, minute] = editingMedication.reminder_time.split(':').map(Number);
      setReminderHour(hour.toString().padStart(2, '0'));
      setReminderMinute(minute.toString().padStart(2, '0'));
    }
  }, [editingMedication]);

  const convertTo24Hour = (hour12: number, period: 'AM' | 'PM'): number => {
    if (period === 'AM') return hour12 === 12 ? 0 : hour12;
    else return hour12 === 12 ? 12 : hour12 + 12;
  };

  const handleSave = async () => {
    if (!medicationName.trim() || !dosage.trim()) {
      Alert.alert('Error', 'Please fill in medication name and dosage');
      return;
    }

    let hour24: number;
    let minute: number;

    if (use24HourFormat) {
      hour24 = parseInt(reminderHour);
      minute = parseInt(reminderMinute);
    } else {
      const hour12 = parseInt(reminderHour);
      minute = parseInt(reminderMinute);
      hour24 = convertTo24Hour(hour12, amPm);
    }

    if (isNaN(hour24) || hour24 < 0 || hour24 > 23 || isNaN(minute) || minute < 0 || minute > 59) {
      Alert.alert('Error', 'Please enter a valid time.');
      return;
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
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(hour24, minute, 0, 0);

      let reminderDateDisplay: string;
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
        reminderDateDisplay = `Tomorrow at ${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      } else {
        reminderDateDisplay = `Today at ${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      }

      const nowIso = now.toISOString();
      const formattedTime = `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;

      const medicationData: any = {
        medication_name: medicationName.trim(),
        dosage: dosage.trim(),
        dosage_unit: dosageUnit,
        frequency,
        reminder_time: formattedTime,
        notes: notes.trim() || null,
        updated_at: nowIso,
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
        medicationData.created_at = nowIso;
        medicationData.start_date = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('medications')
          .insert(medicationData)
          .select()
          .single();

        if (error) throw error;
        medicationId = data.id;
      }

      const hasPermissions = await notificationService.requestPermissions();
      
      if (!hasPermissions) {
        Alert.alert(
          '⚠️ Permissions Required',
          'Medication saved but notifications are disabled.\n\nPlease enable notifications in Settings to receive reminders.',
          [
            {
              text: 'OK',
              onPress: () => {
                resetForm();
                router.back();
              }
            }
          ]
        );
        return;
      }

      const notificationId = await notificationService.scheduleMedicationReminder(
        medicationId,
        medicationName.trim(),
        dosage.trim(),
        dosageUnit,
        hour24,
        minute,
        notes.trim() || undefined
      );

      if (!notificationId) {
        throw new Error('Failed to schedule notification');
      }

      await new Promise(r => setTimeout(r, 500));

      Alert.alert(
        '✅ Success',
        isEditing
          ? `${medicationName} updated!\n\n📅 Reminder scheduled: ${reminderDateDisplay}`
          : `${medicationName} added!\n\n📅 Reminder scheduled: ${reminderDateDisplay}`,
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

    } catch (error: any) {
      Alert.alert('Error', `Failed to save medication: ${error.message || 'Unknown error'}`);
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
    setAmPm('AM');
    setNotes('');
    setTrackInventory(false);
    setStartDate(new Date());
    setExpiryDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
    setTotalQuantity('');
    setCurrentQuantity('');
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

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.header}>
        <View style={styles.headerContent}>
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="white" />
          </Pressable>
          <Text style={styles.title}>{isEditing ? 'Edit Medication' : 'Add Medication'}</Text>
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
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Medication Name *</Text>
                <TextInput
                  style={styles.input}
                  value={medicationName}
                  onChangeText={setMedicationName}
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
                    value={dosage}
                    onChangeText={setDosage}
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
                          dosageUnit === unit && styles.unitButtonActive
                        ]}
                        onPress={() => setDosageUnit(unit)}
                      >
                        <Text style={[
                          styles.unitText,
                          dosageUnit === unit && styles.unitTextActive
                        ]}>
                          {unit}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Frequency</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {frequencies.slice(0, 4).map((freq) => (
                    <Pressable
                      key={freq}
                      style={[
                        styles.frequencyButton,
                        frequency === freq && styles.frequencyButtonActive
                      ]}
                      onPress={() => setFrequency(freq)}
                    >
                      <Text style={[
                        styles.frequencyText,
                        frequency === freq && styles.frequencyTextActive
                      ]}>
                        {freq}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reminder Time</Text>
              
              <View style={styles.timeFormatToggle}>
                <Text style={styles.label}>Time Format</Text>
                <View style={styles.toggleContainer}>
                  <Text style={styles.toggleLabel}>24-hour</Text>
                  <Switch
                    value={!use24HourFormat}
                    onValueChange={(value) => {
                      setUse24HourFormat(!value);
                      if (!value) {
                        setReminderHour('8');
                      } else {
                        setReminderHour('8');
                        setAmPm('AM');
                      }
                    }}
                    trackColor={{ false: '#D1D5DB', true: '#6366F1' }}
                    thumbColor="white"
                  />
                  <Text style={styles.toggleLabel}>12-hour</Text>
                </View>
              </View>

              <View style={styles.timeInputContainer}>
                <TextInput
                  style={[styles.input, styles.timeInput]}
                  value={reminderHour}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, '');
                    if (use24HourFormat) {
                      const num = parseInt(cleaned);
                      if (cleaned === '' || (!isNaN(num) && num >= 0 && num <= 23)) {
                        setReminderHour(cleaned);
                      }
                    } else {
                      const num = parseInt(cleaned);
                      if (cleaned === '' || (!isNaN(num) && num >= 1 && num <= 12)) {
                        setReminderHour(cleaned);
                      }
                    }
                  }}
                  placeholder={use24HourFormat ? "08" : "08"}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholderTextColor="#9CA3AF"
                />
                <Text style={styles.timeSeparator}>:</Text>
                <TextInput
                  style={[styles.input, styles.timeInput]}
                  value={reminderMinute}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, '');
                    const num = parseInt(cleaned);
                    if (cleaned === '' || (!isNaN(num) && num >= 0 && num <= 59)) {
                      setReminderMinute(cleaned);
                    }
                  }}
                  placeholder="00"
                  keyboardType="numeric"
                  maxLength={2}
                  placeholderTextColor="#9CA3AF"
                />
                {!use24HourFormat && (
                  <View style={styles.amPmContainer}>
                    <Pressable
                      style={[styles.amPmButton, amPm === 'AM' && styles.amPmButtonActive]}
                      onPress={() => setAmPm('AM')}
                    >
                      <Text style={[styles.amPmText, amPm === 'AM' && styles.amPmTextActive]}>
                        AM
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.amPmButton, amPm === 'PM' && styles.amPmButtonActive]}
                      onPress={() => setAmPm('PM')}
                    >
                      <Text style={[styles.amPmText, amPm === 'PM' && styles.amPmTextActive]}>
                        PM
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
              <Text style={styles.helperText}>
                {use24HourFormat ? 'Enter time in 24-hour format (0-23)' : 'Enter time in 12-hour format (1-12)'}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Take with food, before meals, side effects, etc."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </>
        )}

        {activeTab === 'inventory' && (
          <>
            <View style={styles.section}>
              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.sectionTitle}>Track Inventory</Text>
                  <Text style={styles.helperText}>Monitor quantity and expiry dates</Text>
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
                  {isEditing ? 'Save Changes' : 'Add Medication'}
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
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 16, fontSize: 16, backgroundColor: '#F9FAFB', color: '#374151' },
  helperText: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  row: { flexDirection: 'row' },
  unitButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F3F4F6', marginRight: 8 },
  unitButtonActive: { backgroundColor: '#6366F1' },
  unitText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  unitTextActive: { color: 'white' },
  frequencyButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 8 },
  frequencyButtonActive: { backgroundColor: '#6366F1' },
  frequencyText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  frequencyTextActive: { color: 'white' },
  timeFormatToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  toggleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeInputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  timeInput: { width: 70, textAlign: 'center' },
  timeSeparator: { fontSize: 24, fontWeight: 'bold', color: '#374151', marginHorizontal: 8 },
  amPmContainer: { flexDirection: 'row', marginLeft: 12, gap: 4 },
  amPmButton: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F3F4F6', borderRadius: 8 },
  amPmButtonActive: { backgroundColor: '#6366F1' },
  amPmText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  amPmTextActive: { color: 'white' },
  dateButton: { flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, backgroundColor: '#F9FAFB' },
  dateText: { fontSize: 16, color: '#374151', marginLeft: 12, fontWeight: '500' },
  notesInput: { height: 80, textAlignVertical: 'top' },
  addButton: { marginHorizontal: 20, marginTop: 8, borderRadius: 12, overflow: 'hidden' },
  addButtonDisabled: { opacity: 0.6 },
  addButtonGradient: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, gap: 8 },
  addButtonText: { color: 'white', fontSize: 18, fontWeight: '700' },
});