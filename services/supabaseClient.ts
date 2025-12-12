import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import 'web-streams-polyfill/polyfill';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ Missing Supabase credentials in environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage, 
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const getCurrentUserId = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
};

export const getCurrentUser = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
};

export interface DatabaseMedication {
  id: string;
  user_id: string;
  medication_name: string;
  dosage: string;
  dosage_unit: string;
  frequency: string;
  start_date: string;
  end_date?: string;
  expiry_date?: string;
  reminder_time: string;
  notes?: string;
  image?: string;
  custom_interval?: number;
  custom_interval_unit?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabaseMedicationLog {
  id: string;
  medication_id: string;
  user_id: string;
  log_date: string;
  status: 'taken' | 'missed' | 'skipped';
  notes?: string;
  logged_at: string;
}

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatTime = (time: string): string => {
  try {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return time;
  }
};