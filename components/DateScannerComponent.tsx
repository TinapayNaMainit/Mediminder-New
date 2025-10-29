// components/DateScannerComponent.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import Modal from 'react-native-modal';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

interface DateScannerProps {
  visible: boolean;
  onClose: () => void;
  onDatesCaptured: (mfgDate: Date | null, expDate: Date | null) => void;
}

export default function DateScannerComponent({ visible, onClose, onDatesCaptured }: DateScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [cameraRef, setCameraRef] = useState<any>(null);

  // Simple date extraction from text using regex
  const extractDates = (text: string): { mfg: Date | null; exp: Date | null } => {
    // Look for common date patterns
    const datePatterns = [
      /(?:MFG|MFD|Manufactured|Production)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
      /(?:EXP|Expiry|Expires|Expiration)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
      /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/g
    ];

    let mfgDate: Date | null = null;
    let expDate: Date | null = null;

    // Try to extract dates
    const matches = text.match(/\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/g);
    if (matches && matches.length >= 2) {
      try {
        const firstDate = new Date(matches[0].replace(/[-/]/g, '/'));
        const secondDate = new Date(matches[1].replace(/[-/]/g, '/'));
        
        // Assume first date is MFG, second is EXP
        if (!isNaN(firstDate.getTime())) mfgDate = firstDate;
        if (!isNaN(secondDate.getTime())) expDate = secondDate;
      } catch (e) {
        console.error('Error parsing dates:', e);
      }
    }

    return { mfg: mfgDate, exp: expDate };
  };

  // Process image using Vision API or OCR
  const processImage = async (imageUri: string) => {
    setProcessing(true);
    try {
      // In a real app, you would send this to a backend OCR service
      // For now, we'll use a simple text extraction simulation
      
      // Google Vision API or Tesseract.js would be used here
      // Example endpoint: await fetch('YOUR_OCR_API_ENDPOINT', { image: imageUri })
      
      // Simulated OCR result (replace with actual OCR)
      Alert.alert(
        'Manual Input Required',
        'Please enter dates manually. OCR feature requires backend setup.',
        [
          {
            text: 'OK',
            onPress: () => {
              // For now, return null dates and let user input manually
              onDatesCaptured(null, null);
              onClose();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Error', 'Failed to process image. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const takePicture = async () => {
    if (cameraRef) {
      try {
        const photo = await cameraRef.takePictureAsync({
          quality: 1,
          base64: true,
        });
        setCapturedImage(photo.uri);
        await processImage(photo.uri);
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture');
      }
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri);
      await processImage(result.assets[0].uri);
    }
  };

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <Modal isVisible={visible} onBackdropPress={onClose} style={styles.modal}>
        <View style={styles.modalContent}>
          <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.header}>
            <Text style={styles.title}>Camera Permission</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="white" />
            </Pressable>
          </LinearGradient>

          <View style={styles.content}>
            <Ionicons name="camera-outline" size={64} color="#6B7280" />
            <Text style={styles.permissionText}>
              Camera access is required to scan medication labels
            </Text>
            <Pressable style={styles.permissionButton} onPress={requestPermission}>
              <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.buttonGradient}>
                <Text style={styles.buttonText}>Grant Permission</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal isVisible={visible} onBackdropPress={onClose} style={styles.modal}>
      <View style={styles.modalContent}>
        <LinearGradient colors={['#6366F1', '#8B5CF6']} style={styles.header}>
          <Text style={styles.title}>Scan Medication Label</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="white" />
          </Pressable>
        </LinearGradient>

        {!capturedImage ? (
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              ref={(ref) => setCameraRef(ref)}
            >
              <View style={styles.cameraOverlay}>
                <View style={styles.scanFrame}>
                  <Text style={styles.scanText}>
                    Position label with MFG and EXP dates
                  </Text>
                </View>
              </View>
            </CameraView>

            <View style={styles.controls}>
              <Pressable style={styles.controlButton} onPress={pickImage}>
                <Ionicons name="images" size={24} color="white" />
                <Text style={styles.controlText}>Gallery</Text>
              </Pressable>

              <Pressable style={styles.captureButton} onPress={takePicture}>
                <View style={styles.captureButtonInner} />
              </Pressable>

              <View style={styles.controlButton} />
            </View>
          </View>
        ) : (
          <View style={styles.previewContainer}>
            <Image source={{ uri: capturedImage }} style={styles.preview} />
            {processing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={styles.processingText}>Processing image...</Text>
              </View>
            )}
            <View style={styles.previewControls}>
              <Pressable
                style={styles.retakeButton}
                onPress={() => setCapturedImage(null)}
              >
                <Text style={styles.retakeText}>Retake</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
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
  permissionText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginVertical: 24,
  },
  permissionButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 300,
    height: 200,
    borderWidth: 3,
    borderColor: 'white',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scanText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  controlButton: {
    alignItems: 'center',
    width: 60,
  },
  controlText: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EF4444',
  },
  previewContainer: {
    flex: 1,
    position: 'relative',
  },
  preview: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 12,
  },
  previewControls: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  retakeButton: {
    backgroundColor: '#6366F1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  retakeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});