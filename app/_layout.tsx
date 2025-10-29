// app/_layout.tsx - UPDATED with SafeAreaProvider
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../contexts/AuthContext';
import AuthWrapper from '../components/AuthWrapper';
import { ProfileProvider } from '../contexts/ProfileContext';
import { notificationService } from '../services/notificationService';
import { supabase } from '../services/supabaseClient';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      initializeNotifications();
    }
  }, [loaded]);

  const initializeNotifications = async () => {
    try {
      console.log('🔔 Initializing notification system...');
      
      await notificationService.setupNotificationCategories();
      console.log('✅ Notification categories set up');
      
      notificationService.setupNotificationResponseHandler(
        handleTakeMedication,
        handleSnoozeMedication,
        handleSkipMedication
      );
      console.log('✅ Notification response handlers set up');
      
    } catch (error) {
      console.error('❌ Error initializing notifications:', error);
    }
  };

  const handleTakeMedication = async (medicationId: string) => {
    try {
      console.log(`💊 Taking medication from notification: ${medicationId}`);
      const today = new Date().toISOString().split('T')[0];
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.warn('⚠️ No user session');
        return;
      }

      const { data: existingLog } = await supabase
        .from('medication_logs')
        .select('id')
        .eq('medication_id', medicationId)
        .eq('user_id', session.user.id)
        .eq('log_date', today)
        .single();

      if (existingLog) {
        const { error } = await supabase
          .from('medication_logs')
          .update({
            status: 'taken',
            logged_at: new Date().toISOString(),
          })
          .eq('id', existingLog.id);

        if (error) throw error;
        console.log('✅ Updated existing log to taken');
      } else {
        const { error } = await supabase
          .from('medication_logs')
          .insert({
            medication_id: medicationId,
            user_id: session.user.id,
            log_date: today,
            status: 'taken',
            logged_at: new Date().toISOString(),
          });

        if (error) throw error;
        console.log('✅ Created new log as taken');
      }
      
      console.log('✅ Medication marked as taken from notification');
    } catch (error) {
      console.error('❌ Error marking medication as taken:', error);
    }
  };

  const handleSnoozeMedication = async (medicationId: string) => {
    try {
      console.log(`⏰ Snoozing medication: ${medicationId}`);
      
      const { data: medication, error } = await supabase
        .from('medications')
        .select('medication_name, dosage, dosage_unit')
        .eq('id', medicationId)
        .single();

      if (error) throw error;

      if (medication) {
        await notificationService.snoozeNotification(
          medicationId,
          medication.medication_name,
          medication.dosage,
          medication.dosage_unit
        );
        console.log('⏰ Medication snoozed for 10 minutes');
      }
    } catch (error) {
      console.error('❌ Error snoozing medication:', error);
    }
  };

  const handleSkipMedication = async (medicationId: string) => {
    try {
      console.log(`⏭️ Skipping medication from notification: ${medicationId}`);
      const today = new Date().toISOString().split('T')[0];
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.warn('⚠️ No user session');
        return;
      }

      const { data: existingLog } = await supabase
        .from('medication_logs')
        .select('id')
        .eq('medication_id', medicationId)
        .eq('user_id', session.user.id)
        .eq('log_date', today)
        .single();

      if (existingLog) {
        const { error } = await supabase
          .from('medication_logs')
          .update({
            status: 'skipped',
            logged_at: new Date().toISOString(),
          })
          .eq('id', existingLog.id);

        if (error) throw error;
        console.log('✅ Updated existing log to skipped');
      } else {
        const { error } = await supabase
          .from('medication_logs')
          .insert({
            medication_id: medicationId,
            user_id: session.user.id,
            log_date: today,
            status: 'skipped',
            logged_at: new Date().toISOString(),
          });

        if (error) throw error;
        console.log('✅ Created new log as skipped');
      }
      
      console.log('⏭️ Medication marked as skipped from notification');
    } catch (error) {
      console.error('❌ Error skipping medication:', error);
    }
  };

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <ProfileProvider>
            <AuthWrapper>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ 
                  presentation: 'modal',
                  headerShown: false
                }} />
              </Stack>
              <StatusBar style="light" />
            </AuthWrapper>
          </ProfileProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}