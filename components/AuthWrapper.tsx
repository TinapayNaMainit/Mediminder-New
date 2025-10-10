// components/AuthWrapper.tsx
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import AuthScreen from '../screens/AuthScreen';
import RoleSelectionScreen from '../screens/RoleSelectionScreen';

interface AuthWrapperProps {
  children: React.ReactNode;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, refreshProfile } = useProfile();
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkRole();
  }, [user, profile, authLoading, profileLoading]);

  const checkRole = () => {
    if (authLoading || profileLoading) {
      setIsChecking(true);
      return;
    }

    if (!user || !profile) {
      setIsChecking(false);
      setShowRoleSelection(false);
      return;
    }

    // Check if role exists and is valid
    const hasValidRole = profile.role === 'patient' || profile.role === 'caregiver';
    
    console.log('🔍 Auth Check:', {
      userId: user.id,
      profileRole: profile.role,
      hasValidRole,
      willShowRoleSelection: !hasValidRole
    });

    setShowRoleSelection(!hasValidRole);
    setIsChecking(false);
  };

  const handleRoleComplete = async () => {
    console.log('🎉 Role complete callback');
    setShowRoleSelection(false);
    await refreshProfile();
  };

  // Show loading
  if (authLoading || profileLoading || isChecking) {
    return (
      <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="white" />
      </LinearGradient>
    );
  }

  // Show login screen if no user
  if (!user) {
    return <AuthScreen />;
  }

  // Show role selection if needed
  if (showRoleSelection) {
    return <RoleSelectionScreen onComplete={handleRoleComplete} />;
  }

  // Show app
  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AuthWrapper;