// screens/RoleSelectionScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export default function RoleSelectionScreen({ onComplete }: { onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'patient' | 'caregiver' | null>(null);
  const { user } = useAuth();

  const handleRoleSelection = async (role: 'patient' | 'caregiver') => {
    if (!user?.id) {
      Alert.alert('Error', 'User not found. Please sign in again.');
      return;
    }

    if (loading) {
      console.log('⚠️ Already processing, ignoring tap');
      return; // Prevent double-tap
    }

    console.log('🎯 User clicked role:', role);
    setSelectedRole(role);
    setLoading(true);

    try {
      console.log('💾 Saving role to database...');

      // Update user profile with role
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          role: role,
          role_selected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log('✅ Role saved successfully:', data);

      // Verify it was saved
      const { data: verifyData, error: verifyError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (verifyError) {
        console.error('❌ Verification error:', verifyError);
        throw verifyError;
      }

      console.log('✅ Verified role in database:', verifyData.role);

      if (verifyData.role !== role) {
        throw new Error('Role was not saved correctly');
      }

      // Wait a moment before continuing
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('🎉 Calling onComplete()');
      onComplete();
    } catch (error: any) {
      console.error('❌ Error setting role:', error);
      Alert.alert('Error', error.message || 'Failed to set role. Please try again.');
      setSelectedRole(null);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.loadingText}>
            Setting up your {selectedRole === 'patient' ? 'Patient' : 'Caregiver'} account...
          </Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Ionicons name="people" size={64} color="white" />
          <Text style={styles.title}>Who will use this app?</Text>
          <Text style={styles.subtitle}>
            Choose your role to get started with personalized features
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          {/* For Me Card */}
          <Pressable
            style={styles.roleCard}
            onPress={() => handleRoleSelection('patient')}
            disabled={loading}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.cardGradient}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="person" size={40} color="white" />
              </View>
              <Text style={styles.cardTitle}>For Me</Text>
              <Text style={styles.cardDescription}>
                I want to manage my own medications and health tracking
              </Text>
              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={18} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.featureText}>Track your medications</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={18} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.featureText}>Get reminders</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={18} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.featureText}>Share with caregiver via QR</Text>
                </View>
              </View>
              <View style={styles.selectButton}>
                <Text style={styles.selectButtonText}>Select</Text>
                <Ionicons name="arrow-forward" size={18} color="white" />
              </View>
            </LinearGradient>
          </Pressable>

          {/* For Someone I Care For Card */}
          <Pressable
            style={styles.roleCard}
            onPress={() => handleRoleSelection('caregiver')}
            disabled={loading}
          >
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              style={styles.cardGradient}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="heart" size={40} color="white" />
              </View>
              <Text style={styles.cardTitle}>For Someone I Care For</Text>
              <Text style={styles.cardDescription}>
                I want to help manage medications for a loved one
              </Text>
              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={18} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.featureText}>Manage their medications</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={18} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.featureText}>Monitor adherence</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={18} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.featureText}>Connect via QR scan</Text>
                </View>
              </View>
              <View style={styles.selectButton}>
                <Text style={styles.selectButtonText}>Select</Text>
                <Ionicons name="arrow-forward" size={18} color="white" />
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        <Text style={styles.footerText}>
          You can change this setting later in your profile
        </Text>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 20,
  },
  roleCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardGradient: {
    padding: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
    marginBottom: 16,
  },
  featuresList: {
    gap: 10,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    flex: 1,
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: 'white',
    marginTop: 20,
    fontWeight: '600',
  },
});