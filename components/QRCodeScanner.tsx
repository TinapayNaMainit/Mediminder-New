// components/QRCodeScanner.tsx - FIXED VERSION
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Modal from 'react-native-modal';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { caregiverService } from '../services/caregiverService';

interface QRCodeScannerProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ 
  visible, 
  onClose, 
  userId,
  onSuccess 
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setManualCode('');
      setShowManualInput(false);
      setConnecting(false);
    }
  }, [visible]);

  // ✅ FIX: Better error handling with specific messages
  const connectWithCode = async (code: string) => {
    if (connecting) return;
    
    const trimmedCode = code.trim().toUpperCase();
    
    if (trimmedCode.length !== 6) {
      Alert.alert('Invalid Code', 'Connection code must be 6 characters long.');
      setScanned(false);
      return;
    }

    setConnecting(true);
    
    try {
      console.log('🔗 Attempting connection with code:', trimmedCode);
      
      await caregiverService.connectWithCode(userId, trimmedCode);
      
      // Success
      Alert.alert(
        '✅ Connected Successfully!',
        'You can now help manage medications for this patient.',
        [
          {
            text: 'OK',
            onPress: () => {
              onSuccess();
              onClose();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('❌ Connection error:', error);
      
      // Show specific error message from service
      const errorMessage = error.message || 'Failed to connect. Please try again.';
      
      Alert.alert(
        'Connection Failed', 
        errorMessage,
        [
          {
            text: 'OK',
            onPress: () => {
              setScanned(false);
              setConnecting(false);
            }
          }
        ]
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || connecting) return;
    
    console.log('📸 QR Code scanned:', data);
    setScanned(true);
    await connectWithCode(data);
  };

  const handleManualConnect = () => {
    if (!manualCode.trim()) {
      Alert.alert('Error', 'Please enter a connection code');
      return;
    }
    
    setScanned(true); // Prevent multiple submissions
    connectWithCode(manualCode);
  };

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <Modal
        isVisible={visible}
        onBackdropPress={onClose}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <View style={styles.handle} />
          
          <LinearGradient
            colors={['#6366F1', '#8B5CF6']}
            style={styles.header}
          >
            <Text style={styles.title}>Camera Permission</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="white" />
            </Pressable>
          </LinearGradient>

          <View style={styles.content}>
            <Ionicons name="camera-outline" size={64} color="#6B7280" />
            <Text style={styles.permissionText}>
              Camera access is required to scan QR codes
            </Text>
            <Pressable style={styles.permissionButton} onPress={requestPermission}>
              <LinearGradient
                colors={['#6366F1', '#8B5CF6']}
                style={styles.permissionButtonGradient}
              >
                <Text style={styles.permissionButtonText}>Grant Permission</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={() => setShowManualInput(true)}>
              <Text style={styles.manualLink}>Or enter code manually</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={!connecting ? onClose : undefined}
      style={styles.modal}
    >
      <View style={styles.modalContent}>
        <View style={styles.handle} />
        
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
          style={styles.header}
        >
          <Text style={styles.title}>
            {showManualInput ? 'Enter Code' : 'Scan QR Code'}
          </Text>
          <Pressable onPress={onClose} style={styles.closeButton} disabled={connecting}>
            <Ionicons name="close" size={24} color="white" />
          </Pressable>
        </LinearGradient>

        <View style={styles.content}>
          {showManualInput ? (
            <View style={styles.manualInputContainer}>
              <Text style={styles.description}>
                Enter the 6-character code shared by the patient
              </Text>
              
              <TextInput
                style={styles.codeInput}
                value={manualCode}
                onChangeText={(text) => setManualCode(text.toUpperCase())}
                placeholder="ABC123"
                placeholderTextColor="#9CA3AF"
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!connecting}
              />

              <Pressable 
                style={[styles.connectButton, connecting && styles.connectButtonDisabled]}
                onPress={handleManualConnect}
                disabled={connecting || !manualCode.trim()}
              >
                <LinearGradient
                  colors={connecting ? ['#9CA3AF', '#6B7280'] : ['#10B981', '#059669']}
                  style={styles.connectButtonGradient}
                >
                  {connecting ? (
                    <>
                      <ActivityIndicator size="small" color="white" />
                      <Text style={styles.connectButtonText}>Connecting...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="link" size={24} color="white" />
                      <Text style={styles.connectButtonText}>Connect</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              {!connecting && (
                <Pressable onPress={() => setShowManualInput(false)}>
                  <Text style={styles.switchLink}>Scan QR code instead</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.description}>
                Point your camera at the patient's QR code to connect
              </Text>

              <View style={styles.cameraContainer}>
                <CameraView
                  style={styles.camera}
                  onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                  barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                  }}
                />
                <View style={styles.scanOverlay}>
                  <View style={styles.scanFrame} />
                  {connecting && (
                    <View style={styles.scanningOverlay}>
                      <ActivityIndicator size="large" color="white" />
                      <Text style={styles.scanningText}>Connecting...</Text>
                    </View>
                  )}
                </View>
              </View>

              {scanned && !connecting && (
                <View style={styles.scanningIndicator}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  <Text style={styles.scanningIndicatorText}>Code scanned!</Text>
                </View>
              )}

              {!connecting && (
                <Pressable onPress={() => setShowManualInput(true)}>
                  <Text style={styles.manualLink}>Enter code manually</Text>
                </Pressable>
              )}
            </>
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
    alignItems: 'center',
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  cameraContainer: {
    width: '100%',
    height: 300,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: 'white',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  scanningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  scanningIndicatorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  manualLink: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  manualInputContainer: {
    width: '100%',
    alignItems: 'center',
  },
  codeInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 20,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 24,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
  },
  connectButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  connectButtonDisabled: {
    opacity: 0.7,
  },
  connectButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    gap: 8,
  },
  connectButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  switchLink: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  permissionText: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 32,
    lineHeight: 26,
  },
  permissionButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  permissionButtonGradient: {
    padding: 18,
    alignItems: 'center',
  },
  permissionButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
});

export default QRCodeScanner;