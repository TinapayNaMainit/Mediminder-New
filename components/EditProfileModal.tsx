import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Pressable,
  Image,
} from 'react-native';
import Modal from 'react-native-modal';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useProfile } from '../contexts/ProfileContext';
import { profileService } from '../services/profileService';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ visible, onClose }) => {
  const { profile, updateProfile, uploadAvatar } = useProfile();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [loading, setLoading] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  React.useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setAvatarUri(null);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter a display name');
      return;
    }

    setLoading(true);
    try {
      let updates: any = { display_name: displayName.trim() };

      // Upload new avatar if selected
      if (avatarUri) {
        const success = await uploadAvatar(avatarUri);
        if (!success) {
          Alert.alert('Warning', 'Failed to upload avatar, but name will be updated');
        }
      } else {
        // Just update name
        const success = await updateProfile(updates);
        if (!success) {
          Alert.alert('Error', 'Failed to update profile');
          return;
        }
      }

      Alert.alert('Success', 'Profile updated successfully');
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const currentAvatarUrl = avatarUri || profile?.avatar_url;
  const initials = profile ? profileService.getInitials(profile.display_name) : 'U';
  const avatarColor = profile ? profileService.getAvatarColor(profile.display_name) : '#667EEA';

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
          <Text style={styles.title}>Edit Profile</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="white" />
          </Pressable>
        </LinearGradient>

        <View style={styles.form}>
          <View style={styles.avatarSection}>
            <Pressable onPress={pickImage} style={styles.avatarContainer}>
              {currentAvatarUrl ? (
                <Image source={{ uri: currentAvatarUrl }} style={styles.avatar} />
              ) : (
                <LinearGradient
                  colors={[avatarColor, avatarColor]}
                  style={styles.avatar}
                >
                  <Text style={styles.avatarText}>{initials}</Text>
                </LinearGradient>
              )}
              <View style={styles.cameraIcon}>
                <Ionicons name="camera" size={20} color="white" />
              </View>
            </Pressable>
            <Text style={styles.avatarLabel}>Tap to change photo</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your name"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <Pressable 
            style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
            onPress={handleSave}
            disabled={loading}
          >
            <LinearGradient
              colors={loading ? ['#9CA3AF', '#6B7280'] : ['#10B981', '#059669']}
              style={styles.saveButtonGradient}
            >
              {loading ? (
                <Ionicons name="refresh" size={24} color="white" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </LinearGradient>
          </Pressable>
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
    maxHeight: '80%',
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
  form: {
    padding: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#6366F1',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  avatarLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
});

export default EditProfileModal;