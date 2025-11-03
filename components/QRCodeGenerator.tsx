// components/QRCodeGenerator.tsx - FIXED VERSION
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Share,
  Alert,
} from 'react-native';
import Modal from 'react-native-modal';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { caregiverService } from '../services/caregiverService';

interface QRCodeGeneratorProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
}

const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ visible, onClose, userId }) => {
  const [connectionCode, setConnectionCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadConnectionCode();
    }
  }, [visible]);

  // ✅ FIX: Better error handling
  const loadConnectionCode = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔑 Loading connection code for user:', userId);
      
      const code = await caregiverService.getConnectionCode(userId);
      
      if (!code) {
        throw new Error('Failed to generate connection code');
      }
      
      console.log('✅ Connection code loaded:', code);
      setConnectionCode(code);
    } catch (error: any) {
      console.error('❌ Error loading connection code:', error);
      setError(error.message || 'Failed to load connection code');
      Alert.alert(
        'Error',
        'Failed to generate connection code. Please try again.',
        [{ text: 'OK', onPress: onClose }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshCode = async () => {
    Alert.alert(
      'Generate New Code',
      'This will invalidate your current code. Existing connections will remain active. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            setError(null);
            
            try {
              console.log('🔄 Generating new connection code...');
              
              const newCode = await caregiverService.generateConnectionCode(userId);
              
              if (!newCode) {
                throw new Error('Failed to generate new code');
              }
              
              console.log('✅ New code generated:', newCode);
              setConnectionCode(newCode);
              
              Alert.alert('Success', 'New connection code generated!');
            } catch (error: any) {
              console.error('❌ Error generating new code:', error);
              setError(error.message || 'Failed to generate new code');
              Alert.alert('Error', 'Failed to generate new code. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleShareCode = async () => {
    if (!connectionCode) {
      Alert.alert('Error', 'No connection code available');
      return;
    }
    
    try {
      const message = `🏥 MediMinder Connection Request

I'd like you to help manage my medications.

📱 Connection Code: ${connectionCode}

How to connect:
1. Open MediMinder app
2. Go to Profile → Scan Patient QR Code
3. Scan this QR code or enter the code manually

This connection allows you to:
• View my medications
• Help me track doses
• Get adherence updates

Thank you for your support! 💊`;

      await Share.share({
        message,
        title: 'MediMinder Connection Code',
      });
      
      console.log('✅ Code shared successfully');
    } catch (error) {
      console.error('❌ Error sharing:', error);
    }
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={!loading ? onClose : undefined}
      onSwipeComplete={!loading ? onClose : undefined}
      swipeDirection={!loading ? "down" : undefined}
      style={styles.modal}
    >
      <View style={styles.modalContent}>
        <View style={styles.handle} />
        
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
          style={styles.header}
        >
          <Text style={styles.title}>Connection QR Code</Text>
          <Pressable onPress={onClose} style={styles.closeButton} disabled={loading}>
            <Ionicons name="close" size={24} color="white" />
          </Pressable>
        </LinearGradient>

        <View style={styles.content}>
          <Text style={styles.description}>
            Share this QR code with your caregiver to give them access to help manage your medications
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={styles.loadingText}>Generating code...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={48} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryButton} onPress={loadConnectionCode}>
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6']}
                  style={styles.retryButtonGradient}
                >
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : connectionCode ? (
            <>
              <View style={styles.qrContainer}>
                <View style={styles.qrWrapper}>
                  <QRCode
                    value={connectionCode}
                    size={200}
                    backgroundColor="white"
                    color="#1F2937"
                  />
                </View>
              </View>

              <View style={styles.codeContainer}>
                <Text style={styles.codeLabel}>Connection Code</Text>
                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>{connectionCode}</Text>
                </View>
                <Text style={styles.codeHint}>
                  Your caregiver can scan the QR code or enter this code manually
                </Text>
              </View>

              <View style={styles.actions}>
                <Pressable style={styles.actionButton} onPress={handleShareCode}>
                  <Ionicons name="share-social" size={20} color="#6366F1" />
                  <Text style={styles.actionButtonText}>Share</Text>
                </Pressable>

                <Pressable style={styles.actionButton} onPress={handleRefreshCode}>
                  <Ionicons name="refresh" size={20} color="#6366F1" />
                  <Text style={styles.actionButtonText}>New Code</Text>
                </Pressable>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color="#6366F1" />
                <Text style={styles.infoText}>
                  This code never expires. Generate a new code anytime. Your caregiver can be anywhere - no need to be close!
                </Text>
              </View>

              <View style={styles.permissionsBox}>
                <Text style={styles.permissionsTitle}>
                  🔐 What caregivers can do:
                </Text>
                <View style={styles.permissionsList}>
                  <Text style={styles.permissionItem}>✓ View your medications</Text>
                  <Text style={styles.permissionItem}>✓ Add new medications</Text>
                  <Text style={styles.permissionItem}>✓ Update medication details</Text>
                  <Text style={styles.permissionItem}>✓ Remove medications</Text>
                  <Text style={styles.permissionItem}>✓ View adherence history</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 8,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 24,
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  retryButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  qrWrapper: {
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  codeContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  codeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  codeBox: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  codeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 4,
  },
  codeHint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF2FF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#4F46E5',
    lineHeight: 20,
  },
  permissionsBox: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  permissionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  permissionsList: {
    gap: 8,
  },
  permissionItem: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
});

export default QRCodeGenerator;