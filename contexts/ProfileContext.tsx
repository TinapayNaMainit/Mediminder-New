import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { profileService, UserProfile } from '../services/profileService';

interface ProfileContextType {
  profile: UserProfile | null;
  loading: boolean;
  updateProfile: (updates: Partial<Pick<UserProfile, 'display_name' | 'avatar_url'>>) => Promise<boolean>;
  uploadAvatar: (uri: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user) {
      loadProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [session]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const userProfile = await profileService.getCurrentProfile();
      setProfile(userProfile);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Pick<UserProfile, 'display_name' | 'avatar_url'>>): Promise<boolean> => {
    try {
      const updatedProfile = await profileService.updateProfile(updates);
      if (updatedProfile) {
        setProfile(updatedProfile);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    }
  };

  const uploadAvatar = async (uri: string): Promise<boolean> => {
    try {
      const avatarUrl = await profileService.uploadAvatar(uri);
      if (avatarUrl) {
        return await updateProfile({ avatar_url: avatarUrl });
      }
      return false;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      return false;
    }
  };

  const refreshProfile = async () => {
    await loadProfile();
  };

  const value = {
    profile,
    loading,
    updateProfile,
    uploadAvatar,
    refreshProfile,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};