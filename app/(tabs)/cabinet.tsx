// app/(tabs)/cabinet.tsx - FIXED: Update Quantity & Low Stock Tab
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { useFocusEffect } from '@react-navigation/native';

interface Medication {
  id: string;
  medication_name: string;
  dosage: string;
  dosage_unit: string;
  total_quantity: number;
  current_quantity: number;
  low_stock_threshold: number;
  expiry_date: string | null;
  is_active: boolean;
  created_at: string;
}

type TabType = 'all' | 'low_stock' | 'expired';

export default function CabinetScreen() {
  const { user } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [filteredMedications, setFilteredMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [quantityInput, setQuantityInput] = useState('');
  const [updateMode, setUpdateMode] = useState<'add' | 'set'>('add');

  useFocusEffect(
    useCallback(() => {
      loadMedications();
    }, [])
  );

  const loadMedications = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const medsWithQuantity = (data || []).filter(
        (med) => med.total_quantity > 0 || med.current_quantity > 0
      );

      setMedications(medsWithQuantity);
      filterMedications(medsWithQuantity, activeTab);
    } catch (error) {
      console.error('Error loading medications:', error);
      Alert.alert('Error', 'Failed to load medications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ✅ FIX: Proper tab filtering logic
  const filterMedications = (meds: Medication[], tab: TabType) => {
    let filtered = [...meds];

    switch (tab) {
      case 'low_stock':
        // ✅ FIX: Show medications where current <= threshold
        filtered = meds.filter(
          (med) => med.current_quantity <= med.low_stock_threshold && med.is_active
        );
        break;
      case 'expired':
        // Show medications that are expired
        filtered = meds.filter((med) => {
          if (!med.expiry_date) return false;
          const expiryDate = new Date(med.expiry_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return expiryDate < today;
        });
        break;
      case 'all':
      default:
        // Show all medications with tracking
        filtered = meds;
        break;
    }

    setFilteredMedications(filtered);
  };

  // ✅ FIX: Handle tab change properly
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    filterMedications(medications, tab);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadMedications();
  };

  // ✅ FIX: Open update modal with proper state
  const openUpdateModal = (medication: Medication) => {
    setSelectedMedication(medication);
    setQuantityInput('');
    setUpdateMode('add');
    setShowUpdateModal(true);
  };

  // ✅ FIX: Update quantity functionality
  const handleUpdateQuantity = async () => {
    if (!selectedMedication || !quantityInput.trim()) {
      Alert.alert('Error', 'Please enter a quantity');
      return;
    }

    const quantity = parseInt(quantityInput);
    if (isNaN(quantity) || quantity < 0) {
      Alert.alert('Error', 'Please enter a valid positive number');
      return;
    }

    try {
      let newCurrentQuantity = selectedMedication.current_quantity;

      if (updateMode === 'add') {
        // Add to current quantity
        newCurrentQuantity = selectedMedication.current_quantity + quantity;
      } else {
        // Set as new quantity
        newCurrentQuantity = quantity;
      }

      // Don't allow exceeding total quantity
      if (newCurrentQuantity > selectedMedication.total_quantity) {
        Alert.alert(
          'Warning',
          `New quantity (${newCurrentQuantity}) exceeds total quantity (${selectedMedication.total_quantity}). Update total quantity first or enter a lower amount.`
        );
        return;
      }

      const { error } = await supabase
        .from('medications')
        .update({
          current_quantity: newCurrentQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedMedication.id);

      if (error) throw error;

      Alert.alert(
        'Success',
        `Updated ${selectedMedication.medication_name} to ${newCurrentQuantity} ${selectedMedication.dosage_unit}`
      );

      setShowUpdateModal(false);
      setSelectedMedication(null);
      setQuantityInput('');
      loadMedications();
    } catch (error) {
      console.error('Error updating quantity:', error);
      Alert.alert('Error', 'Failed to update quantity');
    }
  };

  const getStockStatus = (medication: Medication) => {
    const percentage = (medication.current_quantity / medication.total_quantity) * 100;
    
    if (medication.current_quantity === 0) {
      return { text: 'Out of Stock', color: '#EF4444', icon: 'close-circle' };
    } else if (medication.current_quantity <= medication.low_stock_threshold) {
      return { text: 'Low Stock', color: '#F59E0B', icon: 'warning' };
    } else if (percentage <= 50) {
      return { text: 'Medium Stock', color: '#3B82F6', icon: 'information-circle' };
    } else {
      return { text: 'Good Stock', color: '#10B981', icon: 'checkmark-circle' };
    }
  };

  const isExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expiry < today;
  };

  const getDaysUntilExpiry = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const renderTabButton = (tab: TabType, title: string, icon: string) => (
    <Pressable
      key={tab}
      style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
      onPress={() => handleTabChange(tab)}
    >
      <Ionicons
        name={icon as any}
        size={20}
        color={activeTab === tab ? '#6366F1' : '#6B7280'}
      />
      <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
        {title}
      </Text>
      {/* Badge for low stock and expired */}
      {tab === 'low_stock' && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {medications.filter(m => m.current_quantity <= m.low_stock_threshold && m.is_active).length}
          </Text>
        </View>
      )}
      {tab === 'expired' && (
        <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
          <Text style={styles.badgeText}>
            {medications.filter(m => m.expiry_date && isExpired(m.expiry_date)).length}
          </Text>
        </View>
      )}
    </Pressable>
  );

  const renderMedicationCard = (medication: Medication) => {
    const stockStatus = getStockStatus(medication);
    const expired = isExpired(medication.expiry_date);
    const daysUntilExpiry = getDaysUntilExpiry(medication.expiry_date);
    const percentage = (medication.current_quantity / medication.total_quantity) * 100;

    return (
      <View key={medication.id} style={styles.medicationCard}>
        <View style={styles.cardHeader}>
          <View style={styles.medicationInfo}>
            <Text style={styles.medicationName}>{medication.medication_name}</Text>
            <Text style={styles.medicationDosage}>
              {medication.dosage} {medication.dosage_unit}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: stockStatus.color }]}>
            <Ionicons name={stockStatus.icon as any} size={16} color="white" />
            <Text style={styles.statusText}>{stockStatus.text}</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(percentage, 100)}%`,
                  backgroundColor: stockStatus.color,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {medication.current_quantity} / {medication.total_quantity}
          </Text>
        </View>

        {/* Expiry Info */}
        {medication.expiry_date && (
          <View style={styles.expiryInfo}>
            <Ionicons
              name={expired ? 'warning' : 'calendar-outline'}
              size={16}
              color={expired ? '#EF4444' : daysUntilExpiry && daysUntilExpiry <= 30 ? '#F59E0B' : '#6B7280'}
            />
              <Text
              style={[
                styles.expiryText,
                expired ? styles.expiredText : undefined,
                daysUntilExpiry && daysUntilExpiry <= 30 && !expired ? styles.expiringSoonText : undefined,
              ]}
            >
              {expired
                ? 'EXPIRED'
                : daysUntilExpiry !== null
                ? daysUntilExpiry <= 0
                  ? 'Expires today'
                  : daysUntilExpiry <= 30
                  ? `Expires in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}`
                  : `Expires ${new Date(medication.expiry_date).toLocaleDateString()}`
                : 'No expiry date'}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.cardActions}>
          {/* ✅ FIX: Update Quantity Button */}
          <Pressable
            style={styles.actionButton}
            onPress={() => openUpdateModal(medication)}
          >
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              style={styles.actionButtonGradient}
            >
              <Ionicons name="add-circle-outline" size={18} color="white" />
              <Text style={styles.actionButtonText}>Update Quantity</Text>
            </LinearGradient>
          </Pressable>

          {medication.current_quantity <= medication.low_stock_threshold && (
            <Pressable
              style={styles.actionButton}
              onPress={() =>
                Alert.alert(
                  'Refill Reminder',
                  `Don't forget to refill ${medication.medication_name}!`,
                  [
                    { text: 'Dismiss', style: 'cancel' },
                    {
                      text: 'Update Now',
                      onPress: () => openUpdateModal(medication),
                    },
                  ]
                )
              }
            >
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                style={styles.actionButtonGradient}
              >
                <Ionicons name="notifications-outline" size={18} color="white" />
                <Text style={styles.actionButtonText}>Set Refill Alert</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.header}>
          <Text style={styles.headerTitle}>Medicine Cabinet</Text>
          <Text style={styles.headerSubtitle}>Track your medication inventory</Text>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.header}>
        <Text style={styles.headerTitle}>Medicine Cabinet</Text>
        <Text style={styles.headerSubtitle}>Track your medication inventory</Text>
      </LinearGradient>

      {/* ✅ FIX: Tabs with proper filtering */}
      <View style={styles.tabContainer}>
        {renderTabButton('all', 'All', 'grid')}
        {renderTabButton('low_stock', 'Low Stock', 'warning')}
        {renderTabButton('expired', 'Expired', 'time')}
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {filteredMedications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name={
                activeTab === 'all'
                  ? 'medkit-outline'
                  : activeTab === 'low_stock'
                  ? 'checkmark-circle-outline'
                  : 'calendar-outline'
              }
              size={64}
              color="#D1D5DB"
            />
            <Text style={styles.emptyTitle}>
              {activeTab === 'all'
                ? 'No medications tracked'
                : activeTab === 'low_stock'
                ? 'No low stock items'
                : 'No expired medications'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'all'
                ? 'Enable inventory tracking when adding medications'
                : activeTab === 'low_stock'
                ? 'All your medications are well stocked!'
                : 'All your medications are fresh!'}
            </Text>
          </View>
        ) : (
          <View style={styles.medicationsList}>
            {filteredMedications.map((medication) => renderMedicationCard(medication))}
          </View>
        )}

        {/* Summary Stats */}
        {medications.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>📊 Cabinet Summary</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{medications.length}</Text>
                <Text style={styles.summaryLabel}>Total Tracked</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>
                  {medications.filter(m => m.current_quantity <= m.low_stock_threshold && m.is_active).length}
                </Text>
                <Text style={styles.summaryLabel}>Low Stock</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: '#EF4444' }]}>
                  {medications.filter(m => m.expiry_date && isExpired(m.expiry_date)).length}
                </Text>
                <Text style={styles.summaryLabel}>Expired</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ✅ FIX: Update Quantity Modal */}
      <Modal
        visible={showUpdateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUpdateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Quantity</Text>
              <Pressable onPress={() => setShowUpdateModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </Pressable>
            </View>

            {selectedMedication && (
              <>
                <View style={styles.modalMedInfo}>
                  <Text style={styles.modalMedName}>{selectedMedication.medication_name}</Text>
                  <Text style={styles.modalMedDosage}>
                    Current: {selectedMedication.current_quantity} / {selectedMedication.total_quantity}{' '}
                    {selectedMedication.dosage_unit}
                  </Text>
                </View>

                <View style={styles.modeSelector}>
                  <Pressable
                    style={[styles.modeButton, updateMode === 'add' && styles.modeButtonActive]}
                    onPress={() => setUpdateMode('add')}
                  >
                    <Text style={[styles.modeButtonText, updateMode === 'add' && styles.modeButtonTextActive]}>
                      Add to Current
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modeButton, updateMode === 'set' && styles.modeButtonActive]}
                    onPress={() => setUpdateMode('set')}
                  >
                    <Text style={[styles.modeButtonText, updateMode === 'set' && styles.modeButtonTextActive]}>
                      Set New Amount
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {updateMode === 'add' ? 'Amount to Add' : 'New Quantity'}
                  </Text>
                  <TextInput
                    style={styles.quantityInput}
                    value={quantityInput}
                    onChangeText={setQuantityInput}
                    placeholder={updateMode === 'add' ? 'e.g., 30' : `Max: ${selectedMedication.total_quantity}`}
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                  />
                  {updateMode === 'add' && quantityInput && (
                    <Text style={styles.resultPreview}>
                      New total: {selectedMedication.current_quantity + parseInt(quantityInput || '0')}{' '}
                      {selectedMedication.dosage_unit}
                    </Text>
                  )}
                </View>

                <Pressable style={styles.updateButton} onPress={handleUpdateQuantity}>
                  <LinearGradient colors={['#10B981', '#059669']} style={styles.updateButtonGradient}>
                    <Ionicons name="checkmark-circle" size={20} color="white" />
                    <Text style={styles.updateButtonText}>Update Quantity</Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    gap: 6,
    position: 'relative',
  },
  tabButtonActive: {
    backgroundColor: '#EEF2FF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#6366F1',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  medicationsList: {
    gap: 16,
  },
  medicationCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  medicationDosage: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBackground: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  expiryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  expiryText: {
    fontSize: 13,
    color: '#6B7280',
  },
  expiredText: {
    color: '#EF4444',
    fontWeight: '700',
  },
  expiringSoonText: {
    color: '#F59E0B',
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#6366F1',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalMedInfo: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  modalMedName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  modalMedDosage: {
    fontSize: 14,
    color: '#6B7280',
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#6366F1',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  modeButtonTextActive: {
    color: 'white',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'white',
    color: '#374151',
  },
  resultPreview: {
    fontSize: 13,
    color: '#6366F1',
    marginTop: 6,
    fontWeight: '600',
  },
  updateButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  updateButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  updateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});