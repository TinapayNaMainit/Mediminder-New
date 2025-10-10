// components/QRCodeGenerator.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Share,
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

  useEffect(() => {
    if (visible) {
      loadConnectionCode();
    }
  }, [visible]);

  const loadConnectionCode = async () => {
    setLoading(true);
    const code = await caregiverService.getConnectionCode(userId);
    setConnectionCode(code);
    setLoading(false);
  };

  const handleRefreshCode = async () => {
    setLoading(true);
    const newCode = await caregiverService.generateConnectionCode(userId);
    setConnectionCode(newCode);
    setLoading(false);
  };

  const handleShareCode = async () => {
    if (!connectionCode) return;
    
    try {
      await Share.share({
        message: `Join me on MedReminder! Use this code to help manage my medications: ${connectionCode}`,
        title: 'MedReminder Connection Code',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection="down"
      style={styles.modal}
    >
      <View style={styles.modalContent}>
        <View style={styles.handle} />
        
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
          style={styles.header}
        >
          <Text style={styles.title}>Connection QR Code</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
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
                  Your caregiver can also manually enter this code
                </Text>
              </View>

              <View style={styles.actions}>
                <Pressable style={styles.actionButton} onPress={handleShareCode}>
                  <Ionicons name="share-social" size={20} color="#6366F1" />
                  <Text style={styles.actionButtonText}>Share Code</Text>
                </Pressable>

                <Pressable style={styles.actionButton} onPress={handleRefreshCode}>
                  <Ionicons name="refresh" size={20} color="#6366F1" />
                  <Text style={styles.actionButtonText}>New Code</Text>
                </Pressable>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color="#6366F1" />
                <Text style={styles.infoText}>
                  This code never expires but you can generate a new one anytime
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={48} color="#EF4444" />
              <Text style={styles.errorText}>Failed to generate code</Text>
              <Pressable style={styles.retryButton} onPress={loadConnectionCode}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            </View>
          )}
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
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#4F46E5',
    lineHeight: 20,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default QRCodeGenerator;