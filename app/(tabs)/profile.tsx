// app/(tabs)/profile.tsx - FIXED with FAQ and proper scrolling
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

// ✅ FAQ Data - Official Mediminder FAQ
const FAQ_DATA = [
  // Medication Intervals and Dosage
  {
    id: '1',
    category: 'Medication Intervals and Dosage',
    question: 'What is the recommended interval for taking Biogesic (Paracetamol)?',
    answer: 'Every 4 to 6 hours as needed, not exceeding 4 grams per day for adults.'
  },
  {
    id: '2',
    category: 'Medication Intervals and Dosage',
    question: 'How often can I take Neozep for cold symptoms?',
    answer: 'Every 6 hours as needed, unless otherwise prescribed by a physician.'
  },
  {
    id: '3',
    category: 'Medication Intervals and Dosage',
    question: 'Is it safe to take vitamins and maintenance medicines together?',
    answer: 'Generally safe, but it depends on the specific medications and dosage. Consult your doctor or pharmacist for advice.'
  },
  {
    id: '4',
    category: 'Medication Intervals and Dosage',
    question: 'How long after eating should I take my maintenance medicine?',
    answer: 'Follow the prescription label; most maintenance medicines are taken after meals unless stated otherwise.'
  },
  // Restrictions and Safety
  {
    id: '5',
    category: 'Restrictions and Safety',
    question: 'Can Biogesic be given to children below 12 years old?',
    answer: 'Only if recommended by a doctor and based on proper dosage for age and weight.'
  },
  {
    id: '6',
    category: 'Restrictions and Safety',
    question: 'Is Neozep safe for pregnant or breastfeeding women?',
    answer: 'It is not recommended without medical advice. Always consult a doctor before use.'
  },
  {
    id: '7',
    category: 'Restrictions and Safety',
    question: 'Can elderly patients take multiple maintenance medicines at the same time?',
    answer: 'Yes, if prescribed by a physician. Medication timing and combinations should be managed carefully to avoid interactions.'
  },
  {
    id: '8',
    category: 'Restrictions and Safety',
    question: 'What should I do if I missed a dose of my maintenance medicine?',
    answer: 'Take the missed dose as soon as you remember, unless it\'s almost time for your next dose. Do not double the dose.'
  },
  // App Use and Functionality
  {
    id: '9',
    category: 'App Use and Functionality',
    question: 'How does MediMinder remind users to take medicines on time?',
    answer: 'The app sends timely alerts based on user-set schedules for each medication.'
  },
  {
    id: '10',
    category: 'App Use and Functionality',
    question: 'Can caregivers monitor the medication schedules of their dependents?',
    answer: 'Yes, caregivers can view reminders and logs through linked accounts.'
  },
  {
    id: '11',
    category: 'App Use and Functionality',
    question: 'Does MediMinder notify users of soon-to-expire medicines?',
    answer: 'Yes, the app provides alerts before a medicine\'s expiration date to prevent accidental intake.'
  },
  // General Safety and Health
  {
    id: '12',
    category: 'General Safety and Health',
    question: 'What should I do if I experience side effects after taking my medication?',
    answer: 'Stop taking the medicine and consult a doctor immediately. Seek emergency help if symptoms are severe.'
  },
  {
    id: '13',
    category: 'General Safety and Health',
    question: 'Is the information in MediMinder a substitute for medical consultation?',
    answer: 'No. MediMinder only provides reminders and general medicine information. Always consult a healthcare professional for medical advice.'
  },
  {
    id: '14',
    category: 'General Safety and Health',
    question: 'Can MediMinder be used for over-the-counter (OTC) and prescription drugs alike?',
    answer: 'Yes, users may record both types, but all prescription medicines should still be taken under doctor supervision.'
  }
];

export default function ProfileScreen() {
  const { signOut, user } = useAuth();
  const { profile, refreshProfile } = useProfile();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [aiCompanionEnabled, setAiCompanionEnabled] = useState(true);
  const [connections, setConnections] = useState<CaregiverConnection[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  useEffect(() => {
    notificationService.updateSettings({
      soundEnabled,
      vibrationEnabled,
    });
  }, [soundEnabled, vibrationEnabled]);

  useEffect(() => {
    if (user?.id && profile?.role) {
      loadConnections();
      loadAICompanionStatus();
    }
  }, [user?.id, profile?.role]);

  const loadConnections = async () => {
    if (!user?.id) return;
    const conns = await caregiverService.getConnections(user.id);
    setConnections(conns);
    setRefreshing(false);
  };

  const loadAICompanionStatus = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('ai_companion_enabled')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setAiCompanionEnabled(data?.ai_companion_enabled ?? true);
    } catch (error) {
      // Silent fail
    }
  };

  const handleToggleAICompanion = async (value: boolean) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          ai_companion_enabled: value,
          updated_at: new Date().toISOString() 
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setAiCompanionEnabled(value);
      Alert.alert(
        value ? 'AI Companion Enabled' : 'AI Companion Disabled',
        value 
          ? 'MedCompanion will now appear on your home screen to help answer your health questions.'
          : 'MedCompanion has been hidden from your home screen.'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update AI companion setting');
      setAiCompanionEnabled(!value);
    }
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
              const { error: connError } = await supabase
                .from('caregiver_connections')
                .update({ status: 'revoked', updated_at: new Date().toISOString() })
                .or(`patient_id.eq.${user.id},caregiver_id.eq.${user.id}`);

              if (connError) throw connError;

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
              // Silent fail
            }
          },
        },
      ]
    );
  };

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const displayName = profile?.display_name || 'Loading...';
  const initials = profile ? profileService.getInitials(displayName) : 'U';
  const avatarColor = profile ? profileService.getAvatarColor(displayName) : '#667EEA';
  const userRole = profile?.role;
  const isPatient = userRole === 'patient';
  const isCaregiver = userRole === 'caregiver';

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
        contentContainerStyle={styles.scrollContent}
      >
        {/* AI Companion Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Assistant</Text>
          <View style={styles.settingsGroup}>
            <SettingItem
              title="MedCompanion AI"
              subtitle="Draggable AI chatbot to answer health questions"
              value={aiCompanionEnabled}
              onValueChange={handleToggleAICompanion}
              icon="sparkles"
            />
          </View>
        </View>

        {/* Connections Section */}
        {(isPatient || isCaregiver) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {isPatient ? 'My Caregivers' : 'My Patients'}
            </Text>
            
            <View style={styles.settingsGroup}>
              {isPatient && (
                <Pressable 
                  style={styles.connectionAction}
                  onPress={() => setShowQRGenerator(true)}
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
                  onPress={() => setShowQRScanner(true)}
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

        {/* ✅ FAQ Section - Official Mediminder FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>❓ FAQ - Frequently Asked Questions</Text>
          <Text style={styles.faqDescription}>
            Official medication and app usage guidelines
          </Text>
          
          {/* Medication Intervals and Dosage */}
          <View style={styles.faqCategory}>
            <Text style={styles.faqCategoryTitle}>💊 Medication Intervals and Dosage</Text>
            <View style={styles.settingsGroup}>
              {FAQ_DATA.filter(f => f.category === 'Medication Intervals and Dosage').map((faq) => (
                <View key={faq.id} style={styles.faqItem}>
                  <Pressable
                    style={styles.faqQuestion}
                    onPress={() => toggleFAQ(faq.id)}
                  >
                    <View style={styles.faqQuestionContent}>
                      <Ionicons 
                        name="help-circle" 
                        size={20} 
                        color="#6366F1" 
                        style={styles.faqIcon}
                      />
                      <Text style={styles.faqQuestionText}>{faq.question}</Text>
                    </View>
                    <Ionicons 
                      name={expandedFAQ === faq.id ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color="#9CA3AF" 
                    />
                  </Pressable>
                  {expandedFAQ === faq.id && (
                    <View style={styles.faqAnswer}>
                      <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Restrictions and Safety */}
          <View style={styles.faqCategory}>
            <Text style={styles.faqCategoryTitle}>🛡️ Restrictions and Safety</Text>
            <View style={styles.settingsGroup}>
              {FAQ_DATA.filter(f => f.category === 'Restrictions and Safety').map((faq) => (
                <View key={faq.id} style={styles.faqItem}>
                  <Pressable
                    style={styles.faqQuestion}
                    onPress={() => toggleFAQ(faq.id)}
                  >
                    <View style={styles.faqQuestionContent}>
                      <Ionicons 
                        name="help-circle" 
                        size={20} 
                        color="#6366F1" 
                        style={styles.faqIcon}
                      />
                      <Text style={styles.faqQuestionText}>{faq.question}</Text>
                    </View>
                    <Ionicons 
                      name={expandedFAQ === faq.id ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color="#9CA3AF" 
                    />
                  </Pressable>
                  {expandedFAQ === faq.id && (
                    <View style={styles.faqAnswer}>
                      <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* App Use and Functionality */}
          <View style={styles.faqCategory}>
            <Text style={styles.faqCategoryTitle}>📱 App Use and Functionality</Text>
            <View style={styles.settingsGroup}>
              {FAQ_DATA.filter(f => f.category === 'App Use and Functionality').map((faq) => (
                <View key={faq.id} style={styles.faqItem}>
                  <Pressable
                    style={styles.faqQuestion}
                    onPress={() => toggleFAQ(faq.id)}
                  >
                    <View style={styles.faqQuestionContent}>
                      <Ionicons 
                        name="help-circle" 
                        size={20} 
                        color="#6366F1" 
                        style={styles.faqIcon}
                      />
                      <Text style={styles.faqQuestionText}>{faq.question}</Text>
                    </View>
                    <Ionicons 
                      name={expandedFAQ === faq.id ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color="#9CA3AF" 
                    />
                  </Pressable>
                  {expandedFAQ === faq.id && (
                    <View style={styles.faqAnswer}>
                      <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* General Safety and Health */}
          <View style={styles.faqCategory}>
            <Text style={styles.faqCategoryTitle}>⚕️ General Safety and Health</Text>
            <View style={styles.settingsGroup}>
              {FAQ_DATA.filter(f => f.category === 'General Safety and Health').map((faq) => (
                <View key={faq.id} style={styles.faqItem}>
                  <Pressable
                    style={styles.faqQuestion}
                    onPress={() => toggleFAQ(faq.id)}
                  >
                    <View style={styles.faqQuestionContent}>
                      <Ionicons 
                        name="help-circle" 
                        size={20} 
                        color="#6366F1" 
                        style={styles.faqIcon}
                      />
                      <Text style={styles.faqQuestionText}>{faq.question}</Text>
                    </View>
                    <Ionicons 
                      name={expandedFAQ === faq.id ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color="#9CA3AF" 
                    />
                  </Pressable>
                  {expandedFAQ === faq.id && (
                    <View style={styles.faqAnswer}>
                      <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Important Disclaimer */}
          <View style={styles.disclaimerBox}>
            <Ionicons name="warning" size={24} color="#F59E0B" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.disclaimerTitle}>⚠️ Important Medical Disclaimer</Text>
              <Text style={styles.disclaimerText}>
                MediMinder provides reminders and general medicine information only. This app is NOT a substitute for professional medical consultation. Always consult a healthcare professional for medical advice, diagnosis, or treatment.
              </Text>
            </View>
          </View>
        </View>

        {/* Contact Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.settingsGroup}>
            <SettingItem
              title="Contact Support"
              subtitle="Get in touch with our team"
              onPress={() => Alert.alert('Contact Support', 'Email: support@mediminder.app\nPhone: +1-800-MEDIMINDER')}
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
          <Text style={styles.footerText}>Mediminder v1.2.7</Text>
          <Text style={styles.footerSubtext}>With AI Companion by Google Gemini</Text>
        </View>

        {/* ✅ Extra padding for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      <EditProfileModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
      />

      {isPatient && user?.id && (
        <QRCodeGenerator
          visible={showQRGenerator}
          onClose={() => setShowQRGenerator(false)}
          userId={user.id}
        />
      )}

      {isCaregiver && user?.id && (
        <QRCodeScanner
          visible={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          userId={user.id}
          onSuccess={() => loadConnections()}
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
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 20,
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
  // ✅ FAQ Styles
  faqDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginHorizontal: 16,
    marginBottom: 20,
    lineHeight: 20,
  },
  faqCategory: {
    marginBottom: 24,
  },
  faqCategoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  faqQuestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  faqIcon: {
    marginRight: 12,
  },
  faqQuestionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    lineHeight: 22,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingLeft: 64,
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  disclaimerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 13,
    color: '#92400E',
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