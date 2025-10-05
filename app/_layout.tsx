import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
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

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Handle font loading errors
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // Initialize app when fonts are loaded
  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      initializeNotifications();
      // Reschedule all notifications when app starts
      rescheduleAllNotifications();
    }
  }, [loaded]);

  const initializeNotifications = async () => {
    try {
      console.log('🔔 Initializing notification system...');
      
      // Request notification permissions
      const granted = await notificationService.requestPermissions();
      
      if (granted) {
        console.log('✅ Notification permissions granted');
        
        // Set up notification categories (action buttons)
        await notificationService.setupNotificationCategories();
        console.log('✅ Notification categories set up');
        
        // Set up notification response handlers
        notificationService.setupNotificationResponseHandler(
          handleTakeMedication,
          handleSnoozeMedication,
          handleSkipMedication
        );
        console.log('✅ Notification response handlers set up');
      } else {
        console.warn('⚠️ Notification permissions denied');
      }
    } catch (error) {
      console.error('❌ Error initializing notifications:', error);
    }
  };

  const rescheduleAllNotifications = async () => {
    try {
      // Wait a bit for auth to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.log('📭 No user session, skipping notification rescheduling');
        return;
      }

      console.log('🔄 Rescheduling notifications for user:', session.user.id);

      // Get all active medications
      const { data: medications, error } = await supabase
        .from('medications')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_active', true);

      if (error) {
        console.error('❌ Error fetching medications:', error);
        return;
      }

      if (!medications || medications.length === 0) {
        console.log('📭 No active medications found');
        return;
      }

      console.log(`📋 Found ${medications.length} active medication(s)`);

      // Cancel all existing notifications first
      await notificationService.cancelAllNotifications();
      console.log('🗑️ Cleared all existing notifications');

      // Reschedule for each active medication
      let successCount = 0;
      for (const med of medications) {
        try {
          const [hour, minute] = med.reminder_time.split(':').map(Number);
          const notificationId = await notificationService.scheduleMedicationReminder(
            med.id,
            med.medication_name,
            med.dosage,
            med.dosage_unit,
            hour,
            minute,
            med.notes || undefined
          );
          
          if (notificationId) {
            successCount++;
            console.log(`✅ Scheduled: ${med.medication_name} at ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
          } else {
            console.warn(`⚠️ Failed to schedule: ${med.medication_name}`);
          }
        } catch (medError) {
          console.error(`❌ Error scheduling ${med.medication_name}:`, medError);
        }
      }

      console.log(`✅ Successfully rescheduled ${successCount}/${medications.length} notifications`);
      
      // Log all scheduled notifications for debugging
      const scheduledNotifications = await notificationService.getScheduledNotifications();
      console.log(`📱 Total scheduled notifications: ${scheduledNotifications.length}`);
      
      if (scheduledNotifications.length > 0) {
        console.log('📋 Scheduled notifications:');
        scheduledNotifications.forEach((notif, index) => {
          const trigger = notif.trigger as any;
          console.log(`  ${index + 1}. ${notif.content.title}`);
          console.log(`     ID: ${notif.identifier}`);
          console.log(`     Trigger: ${JSON.stringify(trigger)}`);
        });
      }
    } catch (error) {
      console.error('❌ Error rescheduling notifications:', error);
    }
  };

  const handleTakeMedication = async (medicationId: string) => {
    try {
      console.log(`💊 Taking medication from notification: ${medicationId}`);
      const today = new Date().toISOString().split('T')[0];
      
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.warn('⚠️ No user session');
        return;
      }

      // Check if log already exists
      const { data: existingLog } = await supabase
        .from('medication_logs')
        .select('id')
        .eq('medication_id', medicationId)
        .eq('user_id', session.user.id)
        .eq('log_date', today)
        .single();

      if (existingLog) {
        // Update existing
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
        // Insert new
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
      
      // Get medication details
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
      
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.warn('⚠️ No user session');
        return;
      }

      // Check if log already exists
      const { data: existingLog } = await supabase
        .from('medication_logs')
        .select('id')
        .eq('medication_id', medicationId)
        .eq('user_id', session.user.id)
        .eq('log_date', today)
        .single();

      if (existingLog) {
        // Update existing
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
        // Insert new
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
  );
}