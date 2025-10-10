// app/(tabs)/profile.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Switch,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';
import { profileService } from '../../services/profileService';
import { caregiverService, CaregiverConnection } from '../../services/caregiverService';
import { notificationService } from '../../services/notificationService';
import { supabase } from '../../services/supabaseClient';
import EditProfileModal from '../../components/EditProfileModal';
import QRCodeGenerator from '../../components/QRCodeGenerator';
import QRCodeScanner from '../../components/QRCodeScanner';

export default function ProfileScreen() {
  const { signOut, user } = useAuth();
  const { profile, refreshProfile } = useProfile();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [connections, setConnections] = useState<CaregiverConnection[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    notificationService.updateSettings({
      soundEnabled,
      vibrationEnabled,
    });
  }, [soundEnabled, vibrationEnabled]);

  useEffect(() => {
    if (user?.id && profile?.role) {
      console.log('👤 User role:', profile.role);
      loadConnections();
    }
  }, [user?.id, profile?.role]);

  const loadConnections = async () => {
    if (!user?.id) return;
    const conns = await caregiverService.getConnections(user.id);
    console.log('📋 Loaded connections:', conns.length);
    setConnections(conns);
    setRefreshing(false);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadConnections();
    refreshProfile();
  };

  const handleRemoveConnection = (connection: CaregiverConnection) => {
    const isPatient = connection.patient_id === user?.id;
    const otherPerson = isPatient 
      ? connection.caregiver_profile?.display_name 
      : connection.patient_profile?.display_name;

    Alert.alert(
      'Remove Connection',
      `Are you sure you want to remove ${otherPerson}? They will no longer have access to medications.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const success = await caregiverService.removeConnection(connection.id);
            if (success) {
              Alert.alert('Success', 'Connection removed successfully');
              loadConnections();
            } else {
              Alert.alert('Error', 'Failed to remove connection');
            }
          },
        },
      ]
    );
  };

  const handleChangeRole = () => {
    Alert.alert(
      'Change Role',
      'Changing your role will disconnect all current connections. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change Role',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            
            try {
              // Remove all connections first
              const { error: connError } = await supabase
                .from('caregiver_connections')
                .update({ status: 'revoked', updated_at: new Date().toISOString() })
                .or(`patient_id.eq.${user.id},caregiver_id.eq.${user.id}`);

              if (connError) throw connError;

              // Reset role
              const { error: roleError } = await supabase
                .from('user_profiles')
                .update({ 
                  role: null, 
                  role_selected_at: null,
                  connection_code: null,
                  updated_at: new Date().toISOString() 
                })
                .eq('user_id', user.id);

              if (roleError) throw roleError;

              Alert.alert(
                'Role Reset',
                'Your role has been reset. Please sign in again to select a new role.',
                [
                  {
                    text: 'OK',
                    onPress: async () => {
                      await signOut();
                    }
                  }
                ]
              );
            } catch (error) {
              console.error('Error changing role:', error);
              Alert.alert('Error', 'Failed to change role. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Error signing out:', error);
            }
          },
        },
      ]
    );
  };

  const displayName = profile?.display_name || 'Loading...';
  const initials = profile ? profileService.getInitials(displayName) : 'U';
  const avatarColor = profile ? profileService.getAvatarColor(displayName) : '#667EEA';
  const userRole = profile?.role;
  const isPatient = userRole === 'patient';
  const isCaregiver = userRole === 'caregiver';

  console.log('🔍 Profile Debug:', {
    userRole,
    isPatient,
    isCaregiver,
    profileId: profile?.id,
    userId: user?.id
  });

  const SettingItem: React.FC<{
    title: string;
    subtitle?: string;
    value?: boolean;
    onValueChange?: (value: boolean) => void;
    onPress?: () => void;
    showArrow?: boolean;
    icon: string;
  }> = ({ title, subtitle, value, onValueChange, onPress, showArrow = false, icon }) => (
    <Pressable
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress && !onValueChange}
    >
      <View style={styles.settingIcon}>
        <Ionicons name={icon as any} size={20} color="#6366F1" />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.settingControl}>
        {onValueChange && (
          <Switch
            value={value}
            onValueChange={onValueChange}
            trackColor={{ false: '#E5E7EB', true: '#6366F1' }}
            thumbColor={value ? '#FFFFFF' : '#F3F4F6'}
          />
        )}
        {showArrow && (
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        )}
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#667EEA', '#764BA2']}
        style={styles.header}
      >
        <View style={styles.profileInfo}>
          <Pressable onPress={() => setShowEditModal(true)}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={[avatarColor, avatarColor]}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{initials}</Text>
              </LinearGradient>
            )}
            <View style={styles.editIcon}>
              <Ionicons name="pencil" size={16} color="white" />
            </View>
          </Pressable>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            {(isPatient || isCaregiver) && (
              <View style={styles.roleBadge}>
                <Ionicons 
                  name={isPatient ? "person" : "heart"} 
                  size={14} 
                  color="white" 
                />
                <Text style={styles.roleText}>
                  {isPatient ? 'Patient' : 'Caregiver'}
                </Text>
              </View>
            )}
            <Pressable 
              style={styles.editProfileButton}
              onPress={() => setShowEditModal(true)}
            >
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Connections Section - Only show if role is set */}
        {(isPatient || isCaregiver) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {isPatient ? 'My Caregivers' : 'My Patients'}
            </Text>
            
            <View style={styles.settingsGroup}>
              {isPatient && (
                <Pressable 
                  style={styles.connectionAction}
                  onPress={() => {
                    console.log('📱 Opening QR Generator');
                    setShowQRGenerator(true);
                  }}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.connectionActionGradient}
                  >
                    <Ionicons name="qr-code" size={24} color="white" />
                    <Text style={styles.connectionActionText}>Share My QR Code</Text>
                  </LinearGradient>
                </Pressable>
              )}

              {isCaregiver && (
                <Pressable 
                  style={styles.connectionAction}
                  onPress={() => {
                    console.log('📷 Opening QR Scanner');
                    setShowQRScanner(true);
                  }}
                >
                  <LinearGradient
                    colors={['#6366F1', '#8B5CF6']}
                    style={styles.connectionActionGradient}
                  >
                    <Ionicons name="scan" size={24} color="white" />
                    <Text style={styles.connectionActionText}>Scan Patient QR Code</Text>
                  </LinearGradient>
                </Pressable>
              )}

              {connections.length > 0 ? (
                connections.map((connection) => {
                  const isPatientView = connection.patient_id === user?.id;
                  const otherPerson = isPatientView 
                    ? connection.caregiver_profile 
                    : connection.patient_profile;
                  const otherRole = isPatientView ? 'Caregiver' : 'Patient';

                  return (
                    <View key={connection.id} style={styles.connectionItem}>
                      <View style={styles.connectionAvatar}>
                        {otherPerson?.avatar_url ? (
                          <Image 
                            source={{ uri: otherPerson.avatar_url }} 
                            style={styles.connectionAvatarImage} 
                          />
                        ) : (
                          <View style={styles.connectionAvatarPlaceholder}>
                            <Text style={styles.connectionAvatarText}>
                              {profileService.getInitials(otherPerson?.display_name || 'U')}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.connectionInfo}>
                        <Text style={styles.connectionName}>
                          {otherPerson?.display_name || 'Unknown'}
                        </Text>
                        <Text style={styles.connectionRole}>{otherRole}</Text>
                      </View>
                      <Pressable 
                        style={styles.removeButton}
                        onPress={() => handleRemoveConnection(connection)}
                      >
                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                      </Pressable>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyConnections}>
                  <Ionicons name="people-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyConnectionsText}>
                    {isPatient 
                      ? 'No caregivers connected yet.\nShare your QR code to get started!'
                      : 'No patients connected yet.\nScan a patient\'s QR code to get started!'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Settings</Text>
          <View style={styles.settingsGroup}>
            <SettingItem
              title="Push Notifications"
              subtitle="Get reminded when it's time to take medication"
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              icon="notifications"
            />
            <SettingItem
              title="Sound"
              subtitle="Play sound with notifications"
              value={soundEnabled}
              onValueChange={setSoundEnabled}
              icon="volume-high"
            />
            <SettingItem
              title="Vibration"
              subtitle="Vibrate when receiving notifications"
              value={vibrationEnabled}
              onValueChange={setVibrationEnabled}
              icon="phone-portrait"
            />
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.settingsGroup}>
            <SettingItem
              title="Help Center"
              subtitle="Get help and find answers"
              onPress={() => Alert.alert('Help Center', 'Feature coming soon!')}
              showArrow
              icon="help-circle"
            />
            <SettingItem
              title="Contact Support"
              subtitle="Get in touch with our team"
              onPress={() => Alert.alert('Contact Support', 'Feature coming soon!')}
              showArrow
              icon="mail"
            />
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingsGroup}>
            {(isPatient || isCaregiver) && (
              <SettingItem
                title="Change Role"
                subtitle="Switch between Patient and Caregiver"
                onPress={handleChangeRole}
                showArrow
                icon="swap-horizontal"
              />
            )}
            
            <Pressable style={styles.signOutButton} onPress={handleSignOut}>
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                style={styles.signOutGradient}
              >
                <Ionicons name="log-out-outline" size={20} color="white" />
                <Text style={styles.signOutText}>Sign Out</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>MedReminder v1.0.0</Text>
          <Text style={styles.footerSubtext}>Patient-Caregiver Connection System</Text>
        </View>
      </ScrollView>

      <EditProfileModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
      />

      {isPatient && user?.id && (
        <QRCodeGenerator
          visible={showQRGenerator}
          onClose={() => {
            console.log('🔒 Closing QR Generator');
            setShowQRGenerator(false);
          }}
          userId={user.id}
        />
      )}

      {isCaregiver && user?.id && (
        <QRCodeScanner
          visible={showQRScanner}
          onClose={() => {
            console.log('🔒 Closing QR Scanner');
            setShowQRScanner(false);
          }}
          userId={user.id}
          onSuccess={() => {
            console.log('✅ Connection successful');
            loadConnections();
          }}
        />
      )}
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
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    position: 'relative',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
  },
  editIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#6366F1',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
  },
  userEmail: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 12,
    gap: 6,
  },
  roleText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  editProfileButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  editProfileText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  settingsGroup: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  settingControl: {
    marginLeft: 12,
  },
  connectionAction: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  connectionActionGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  connectionActionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  connectionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  connectionAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  connectionAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectionAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  connectionRole: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
  },
  emptyConnections: {
    alignItems: 'center',
    padding: 40,
  },
  emptyConnectionsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  signOutButton: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  signOutGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  signOutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    padding: 32,
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
});