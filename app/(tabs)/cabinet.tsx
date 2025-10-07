// @ts-nocheck 
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';

interface MedicationInventory {
  id: string;
  medication_name: string;
  dosage: string;
  dosage_unit: string;
  total_quantity: number;
  current_quantity: number;
  low_stock_threshold: number;
  expiry_date: string;
  start_date: string;
  is_active: boolean;
}

export default function MedicineCabinetScreen() {
  const { user } = useAuth();
  const [medications, setMedications] = useState<MedicationInventory[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'low_stock' | 'expiring'>('all');

  const CURRENT_USER_ID = user?.id;

  useFocusEffect(
    useCallback(() => {
      if (CURRENT_USER_ID) {
        loadMedications();
        
        // Set up real-time subscription
        const subscription = setupRealtimeSubscription();
        
        return () => {
          subscription?.unsubscribe();
        };
      }
    }, [CURRENT_USER_ID, filter])
  );

  const setupRealtimeSubscription = () => {
    if (!CURRENT_USER_ID) return null;

    const channel = supabase
      .channel('cabinet_medications_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'medications',
          filter: `user_id=eq.${CURRENT_USER_ID}`,
        },
        (payload) => {
          console.log('Medication updated:', payload);
          loadMedications();
        }
      )
      .subscribe();

    return channel;
  };

  const loadMedications = async () => {
    if (!CURRENT_USER_ID) return;

    try {
      setLoading(true);
      let query = supabase
        .from('medications')
        .select('*')
        .eq('user_id', CURRENT_USER_ID)
        .eq('is_active', true)
        .order('current_quantity', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      let filteredData = data || [];

      if (filter === 'low_stock') {
        filteredData = filteredData.filter(
          med => med.current_quantity <= med.low_stock_threshold
        );
      } else if (filter === 'expiring') {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        filteredData = filteredData.filter(med => {
          if (!med.expiry_date) return false;
          const expiryDate = new Date(med.expiry_date);
          return expiryDate <= thirtyDaysFromNow && expiryDate >= new Date();
        });
      }

      setMedications(filteredData);
    } catch (error) {
      console.error('Error loading medications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMedications();
  };

  const getStockStatus = (current: number, threshold: number) => {
    if (current === 0) return { status: 'out', color: '#EF4444', icon: 'close-circle', text: 'Out of Stock' };
    if (current <= threshold) return { status: 'low', color: '#F59E0B', icon: 'warning', text: 'Low Stock' };
    return { status: 'good', color: '#10B981', icon: 'checkmark-circle', text: 'In Stock' };
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryStatus = (expiryDate: string) => {
    const days = getDaysUntilExpiry(expiryDate);
    if (days < 0) return { color: '#EF4444', text: 'Expired', urgent: true };
    if (days <= 7) return { color: '#EF4444', text: `${days} days left`, urgent: true };
    if (days <= 30) return { color: '#F59E0B', text: `${days} days left`, urgent: false };
    return { color: '#10B981', text: `${days} days left`, urgent: false };
  };

  const handleUpdateQuantity = (medication: MedicationInventory) => {
    Alert.prompt(
      'Update Quantity',
      `Current quantity: ${medication.current_quantity}\nEnter new quantity:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async (value) => {
            const newQty = parseInt(value || '0');
            if (isNaN(newQty) || newQty < 0) {
              Alert.alert('Error', 'Please enter a valid number');
              return;
            }

            try {
              const { error } = await supabase
                .from('medications')
                .update({ 
                  current_quantity: newQty,
                  updated_at: new Date().toISOString()
                })
                .eq('id', medication.id);

              if (error) throw error;

              Alert.alert('Success', 'Quantity updated successfully');
              loadMedications();
            } catch (error) {
              console.error('Error updating quantity:', error);
              Alert.alert('Error', 'Failed to update quantity');
            }
          }
        }
      ],
      'plain-text',
      medication.current_quantity.toString()
    );
  };

  const renderFilterButton = (filterType: typeof filter, label: string, icon: string, count: number) => (
    <Pressable
      key={filterType}
      style={[styles.filterButton, filter === filterType && styles.filterButtonActive]}
      onPress={() => setFilter(filterType)}
    >
      <Ionicons 
        name={icon as any} 
        size={20} 
        color={filter === filterType ? '#6366F1' : '#6B7280'} 
      />
      <Text style={[styles.filterText, filter === filterType && styles.filterTextActive]}>
        {label}
      </Text>
      <View style={[styles.badge, filter === filterType && styles.badgeActive]}>
        <Text style={[styles.badgeText, filter === filterType && styles.badgeTextActive]}>
          {count}
        </Text>
      </View>
    </Pressable>
  );

  const renderMedicationCard = (medication: MedicationInventory) => {
    const stockInfo = getStockStatus(medication.current_quantity, medication.low_stock_threshold);
    const expiryInfo = medication.expiry_date ? getExpiryStatus(medication.expiry_date) : null;
    const percentRemaining = (medication.current_quantity / medication.total_quantity) * 100;

    return (
      <View key={medication.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.medicationInfo}>
            <Text style={styles.medicationName}>{medication.medication_name}</Text>
            <Text style={styles.dosageInfo}>
              {medication.dosage} {medication.dosage_unit}
            </Text>
          </View>
          <Ionicons 
            name={stockInfo.icon as any} 
            size={32} 
            color={stockInfo.color} 
          />
        </View>

        <View style={styles.progressSection}>
          <View style={styles.quantityRow}>
            <Text style={styles.quantityLabel}>Quantity Remaining</Text>
            <Text style={styles.quantityValue}>
              {medication.current_quantity} / {medication.total_quantity}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${Math.max(percentRemaining, 5)}%`,
                  backgroundColor: stockInfo.color 
                }
              ]} 
            />
          </View>
          <Text style={[styles.statusText, { color: stockInfo.color }]}>
            {stockInfo.text}
          </Text>
        </View>

        {expiryInfo && (
          <View style={[styles.expirySection, expiryInfo.urgent && styles.expirySectionUrgent]}>
            <Ionicons name="time-outline" size={16} color={expiryInfo.color} />
            <Text style={[styles.expiryText, { color: expiryInfo.color }]}>
              Expires: {new Date(medication.expiry_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })} ({expiryInfo.text})
            </Text>
          </View>
        )}

        <View style={styles.cardActions}>
          <Pressable 
            style={styles.actionButton}
            onPress={() => handleUpdateQuantity(medication)}
          >
            <Ionicons name="create-outline" size={18} color="#6366F1" />
            <Text style={styles.actionButtonText}>Update Quantity</Text>
          </Pressable>
          
          <Pressable 
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/medications')}
          >
            <Ionicons name="information-circle-outline" size={18} color="#6366F1" />
            <Text style={styles.actionButtonText}>View Details</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  if (!CURRENT_USER_ID) return null;

  const lowStockCount = medications.filter(m => m.current_quantity <= m.low_stock_threshold).length;
  const expiringCount = medications.filter(m => {
    if (!m.expiry_date) return false;
    const days = getDaysUntilExpiry(m.expiry_date);
    return days >= 0 && days <= 30;
  }).length;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.header}>
        <Text style={styles.headerTitle}>Medicine Cabinet</Text>
        <Text style={styles.headerSubtitle}>Track your medication inventory</Text>
      </LinearGradient>

      <View style={styles.filterContainer}>
        {renderFilterButton('all', 'All', 'grid', medications.length)}
        {renderFilterButton('low_stock', 'Low Stock', 'warning', lowStockCount)}
        {renderFilterButton('expiring', 'Expiring', 'time', expiringCount)}
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {medications.length > 0 ? (
          medications.map(renderMedicationCard)
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="medkit-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>
              {filter === 'all' ? 'No medications in cabinet' :
               filter === 'low_stock' ? 'No low stock items' :
               'No expiring medications'}
            </Text>
            <Text style={styles.emptyText}>
              {filter === 'all' 
                ? 'Add medications to start tracking your inventory'
                : 'Great! Everything looks good'}
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    gap: 4,
  },
  filterButtonActive: {
    backgroundColor: '#EEF2FF',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#6366F1',
  },
  badge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: '#6366F1',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  badgeTextActive: {
    color: 'white',
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  card: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
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
  dosageInfo: {
    fontSize: 14,
    color: '#6B7280',
  },
  progressSection: {
    marginBottom: 16,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  quantityLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  quantityValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  expirySection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  expirySectionUrgent: {
    backgroundColor: '#FEF3C7',
  },
  expiryText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});