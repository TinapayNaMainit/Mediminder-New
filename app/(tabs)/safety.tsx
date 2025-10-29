// app/(tabs)/safety.tsx - NEW SCREEN for Safety Features
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
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { 
  safetyService, 
  disposalService, 
  inventoryService 
} from '../../services/medicationEnhancedService';

interface ExpiredMedication {
  id: string;
  medication_name: string;
  expiry_date: string;
  days_expired: number;
}

interface LowStockMedication {
  id: string;
  medication_name: string;
  current_quantity: number;
  low_stock_threshold: number;
  days_until_empty: number;
}

interface DrugInteraction {
  medication1: string;
  medication2: string;
  severity: string;
  description: string;
}

export default function SafetyDashboardScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [expiredMeds, setExpiredMeds] = useState<ExpiredMedication[]>([]);
  const [lowStockMeds, setLowStockMeds] = useState<LowStockMedication[]>([]);
  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [expiringCount, setExpiringCount] = useState(0);

  const CURRENT_USER_ID = user?.id;

  useFocusEffect(
    useCallback(() => {
      if (CURRENT_USER_ID) {
        loadSafetyData();
      }
    }, [CURRENT_USER_ID])
  );

  const loadSafetyData = async () => {
    if (!CURRENT_USER_ID) return;

    try {
      setLoading(true);

      // Load expired medications
      const { data: expired, error: expiredError } = await supabase
        .rpc('check_expired_medications', { p_user_id: CURRENT_USER_ID });

      if (!expiredError && expired) {
        setExpiredMeds(expired);
      }

      // Load low stock medications
      const { data: lowStock, error: lowStockError } = await supabase
        .rpc('get_low_stock_medications', { p_user_id: CURRENT_USER_ID });

      if (!lowStockError && lowStock) {
        setLowStockMeds(lowStock);
      }

      // Load drug interactions
      const { data: interactionData, error: interactionError } = await supabase
        .rpc('check_user_drug_interactions', { p_user_id: CURRENT_USER_ID });

      if (!interactionError && interactionData) {
        setInteractions(interactionData);
      }

      // Count expiring soon (30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const { count } = await supabase
        .from('medications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', CURRENT_USER_ID)
        .eq('is_active', true)
        .gte('expiry_date', new Date().toISOString().split('T')[0])
        .lte('expiry_date', thirtyDaysFromNow.toISOString().split('T')[0]);

      setExpiringCount(count || 0);

    } catch (error) {
      console.error('Error loading safety data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSafetyData();
  };

  const handleDisposal = (medication: ExpiredMedication) => {
    Alert.alert(
      'Dispose Expired Medication',
      `How would you like to dispose of ${medication.medication_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'View Guidelines', 
          onPress: () => showDisposalGuidelines(medication) 
        },
        { 
          text: 'Mark as Disposed', 
          style: 'destructive',
          onPress: () => markAsDisposed(medication) 
        },
      ]
    );
  };

  const showDisposalGuidelines = (medication: ExpiredMedication) => {
    const guidelines = disposalService.getDisposalInstructions('default');
    Alert.alert(
      `Disposal Guide: ${medication.medication_name}`,
      guidelines,
      [
        { text: 'Close', style: 'cancel' },
        { 
          text: 'Mark as Disposed', 
          onPress: () => markAsDisposed(medication) 
        }
      ]
    );
  };

  const markAsDisposed = async (medication: ExpiredMedication) => {
    try {
      // Log disposal
      await supabase
        .from('disposal_logs')
        .insert({
          medication_id: medication.id,
          user_id: CURRENT_USER_ID,
          medication_name: medication.medication_name,
          disposal_method: 'user_reported',
          disposal_date: new Date().toISOString().split('T')[0],
          notes: 'Disposed via app tracking'
        });

      // Deactivate medication
      await supabase
        .from('medications')
        .update({ 
          is_active: false,
          disposed_at: new Date().toISOString()
        })
        .eq('id', medication.id);

      Alert.alert('✅ Success', 'Medication marked as disposed');
      loadSafetyData();
    } catch (error) {
      console.error('Error marking as disposed:', error);
      Alert.alert('Error', 'Failed to mark as disposed');
    }
  };

  const handleRefillRequest = async (medication: LowStockMedication) => {
    Alert.alert(
      'Request Refill',
      `Request refill for ${medication.medication_name}?\n\nCurrent: ${medication.current_quantity}\nDays left: ~${medication.days_until_empty}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Request Refill', 
          onPress: async () => {
            try {
              await supabase
                .from('refill_requests')
                .insert({
                  medication_id: medication.id,
                  user_id: CURRENT_USER_ID,
                  quantity_requested: 30, // Default
                  status: 'pending',
                  requested_at: new Date().toISOString()
                });

              Alert.alert(
                '✅ Refill Requested',
                'Your refill request has been logged. In production, this would notify your pharmacy.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('Error requesting refill:', error);
              Alert.alert('Error', 'Failed to request refill');
            }
          }
        }
      ]
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'severe': return '#EF4444';
      case 'moderate': return '#F59E0B';
      case 'mild': return '#10B981';
      default: return '#6B7280';
    }
  };

  if (!CURRENT_USER_ID) return null;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.header}>
        <Text style={styles.headerTitle}>Safety Dashboard</Text>
        <Text style={styles.headerSubtitle}>Monitor medication safety & disposal</Text>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: expiredMeds.length > 0 ? '#FEE2E2' : '#D1FAE5' }]}>
            <Ionicons 
              name={expiredMeds.length > 0 ? "alert-circle" : "checkmark-circle"} 
              size={32} 
              color={expiredMeds.length > 0 ? "#EF4444" : "#10B981"} 
            />
            <Text style={[styles.statNumber, { color: expiredMeds.length > 0 ? "#EF4444" : "#10B981" }]}>
              {expiredMeds.length}
            </Text>
            <Text style={styles.statLabel}>Expired</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: expiringCount > 0 ? '#FEF3C7' : '#E0E7FF' }]}>
            <Ionicons name="time" size={32} color={expiringCount > 0 ? "#F59E0B" : "#6366F1"} />
            <Text style={[styles.statNumber, { color: expiringCount > 0 ? "#F59E0B" : "#6366F1" }]}>
              {expiringCount}
            </Text>
            <Text style={styles.statLabel}>Expiring Soon</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: lowStockMeds.length > 0 ? '#FEF3C7' : '#D1FAE5' }]}>
            <Ionicons 
              name={lowStockMeds.length > 0 ? "warning" : "cube"} 
              size={32} 
              color={lowStockMeds.length > 0 ? "#F59E0B" : "#10B981"} 
            />
            <Text style={[styles.statNumber, { color: lowStockMeds.length > 0 ? "#F59E0B" : "#10B981" }]}>
              {lowStockMeds.length}
            </Text>
            <Text style={styles.statLabel}>Low Stock</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: interactions.length > 0 ? '#FEE2E2' : '#D1FAE5' }]}>
            <Ionicons 
              name={interactions.length > 0 ? "warning" : "shield-checkmark"} 
              size={32} 
              color={interactions.length > 0 ? "#EF4444" : "#10B981"} 
            />
            <Text style={[styles.statNumber, { color: interactions.length > 0 ? "#EF4444" : "#10B981" }]}>
              {interactions.length}
            </Text>
            <Text style={styles.statLabel}>Interactions</Text>
          </View>
        </View>

        {/* Drug Interactions */}
        {interactions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Drug Interactions Detected</Text>
            {interactions.map((interaction, index) => (
              <View key={index} style={styles.interactionCard}>
                <View style={styles.interactionHeader}>
                  <Ionicons name="warning" size={24} color={getSeverityColor(interaction.severity)} />
                  <View style={styles.interactionInfo}>
                    <Text style={styles.interactionTitle}>
                      {interaction.medication1} + {interaction.medication2}
                    </Text>
                    <View style={[
                      styles.severityBadge,
                      { backgroundColor: getSeverityColor(interaction.severity) + '20' }
                    ]}>
                      <Text style={[
                        styles.severityText,
                        { color: getSeverityColor(interaction.severity) }
                      ]}>
                        {interaction.severity.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.interactionDescription}>{interaction.description}</Text>
                <Pressable style={styles.contactButton}>
                  <Ionicons name="call-outline" size={18} color="#6366F1" />
                  <Text style={styles.contactButtonText}>Contact Doctor</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Expired Medications */}
        {expiredMeds.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🗑️ Expired Medications</Text>
            {expiredMeds.map((med) => (
              <View key={med.id} style={styles.medicationCard}>
                <View style={styles.medicationHeader}>
                  <View style={styles.medicationInfo}>
                    <Text style={styles.medicationName}>{med.medication_name}</Text>
                    <Text style={styles.expiredText}>
                      Expired: {new Date(med.expiry_date).toLocaleDateString()}
                    </Text>
                    <Text style={styles.daysText}>
                      {med.days_expired} days ago
                    </Text>
                  </View>
                  <Ionicons name="alert-circle" size={32} color="#EF4444" />
                </View>
                <Pressable
                  style={styles.disposalButton}
                  onPress={() => handleDisposal(med)}
                >
                  <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    style={styles.disposalButtonGradient}
                  >
                    <Ionicons name="trash" size={20} color="white" />
                    <Text style={styles.disposalButtonText}>Disposal Guide</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Low Stock Medications */}
        {lowStockMeds.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📦 Low Stock Alerts</Text>
            {lowStockMeds.map((med) => (
              <View key={med.id} style={styles.medicationCard}>
                <View style={styles.medicationHeader}>
                  <View style={styles.medicationInfo}>
                    <Text style={styles.medicationName}>{med.medication_name}</Text>
                    <Text style={styles.stockText}>
                      {med.current_quantity} remaining (threshold: {med.low_stock_threshold})
                    </Text>
                    <Text style={styles.daysText}>
                      ~{med.days_until_empty} days until empty
                    </Text>
                  </View>
                  <Ionicons name="cube" size={32} color="#F59E0B" />
                </View>
                <Pressable
                  style={styles.refillButton}
                  onPress={() => handleRefillRequest(med)}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.refillButtonGradient}
                  >
                    <Ionicons name="refresh" size={20} color="white" />
                    <Text style={styles.refillButtonText}>Request Refill</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* All Clear Message */}
        {expiredMeds.length === 0 && lowStockMeds.length === 0 && interactions.length === 0 && (
          <View style={styles.allClearSection}>
            <Ionicons name="shield-checkmark" size={64} color="#10B981" />
            <Text style={styles.allClearTitle}>All Clear!</Text>
            <Text style={styles.allClearText}>
              No expired medications, low stock items, or drug interactions detected.
            </Text>
          </View>
        )}

        {/* Disposal Information */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>📚 Safe Disposal Information</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>DO NOT:</Text>{'\n'}
              • Flush medications down toilet{'\n'}
              • Pour down sink drain{'\n'}
              • Give to others{'\n\n'}
              
              <Text style={styles.infoBold}>DO:</Text>{'\n'}
              • Use FDA-approved disposal bags{'\n'}
              • Take to drug take-back program{'\n'}
              • Mix with coffee grounds/dirt before trash{'\n'}
              • Remove personal info from bottles{'\n\n'}
              
              <Text style={styles.infoBold}>Find locations:</Text>{'\n'}
              📞 email: ask@fda.gov.ph{'\n'}
              🌐 Visit fda.gov.ph to learn more about Drug Disposal
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingTop: 50, paddingBottom: 30, paddingHorizontal: 20 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: 'white' },
  headerSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  content: { flex: 1 },
  statsContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },
  statCard: { flex: 1, minWidth: '45%', padding: 16, borderRadius: 12, alignItems: 'center' },
  statNumber: { fontSize: 32, fontWeight: '700', marginTop: 8 },
  statLabel: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 16 },
  interactionCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#EF4444' },
  interactionHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  interactionInfo: { flex: 1, marginLeft: 12 },
  interactionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  severityBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  severityText: { fontSize: 12, fontWeight: '700' },
  interactionDescription: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 12 },
  contactButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#EEF2FF', borderRadius: 8, gap: 6 },
  contactButtonText: { fontSize: 14, fontWeight: '600', color: '#6366F1' },
  medicationCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12 },
  medicationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  medicationInfo: { flex: 1 },
  medicationName: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  expiredText: { fontSize: 14, color: '#EF4444', marginBottom: 2 },
  stockText: { fontSize: 14, color: '#F59E0B', marginBottom: 2 },
  daysText: { fontSize: 13, color: '#6B7280' },
  disposalButton: { borderRadius: 10, overflow: 'hidden' },
  disposalButtonGradient: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 14, gap: 8 },
  disposalButtonText: { fontSize: 16, fontWeight: '700', color: 'white' },
  refillButton: { borderRadius: 10, overflow: 'hidden' },
  refillButtonGradient: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 14, gap: 8 },
  refillButtonText: { fontSize: 16, fontWeight: '700', color: 'white' },
  allClearSection: { alignItems: 'center', padding: 40, marginTop: 40 },
  allClearTitle: { fontSize: 24, fontWeight: '700', color: '#10B981', marginTop: 16 },
  allClearText: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 22 },
  infoSection: { padding: 16 },
  infoTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 16 },
  infoCard: { backgroundColor: 'white', padding: 20, borderRadius: 12 },
  infoText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  infoBold: { fontWeight: '700', color: '#1F2937' },
});