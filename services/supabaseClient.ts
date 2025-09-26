import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { createClient } from '@supabase/supabase-js';
import 'react-native-polyfill-globals/auto';

const supabaseUrl = 'https://yohyvjvhipztuchccinx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvaHl2anZoaXB6dHVjaGNjaW54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2Nzg3MjgsImV4cCI6MjA3NDI1NDcyOH0.fCw9ogLvrDMwdWFtM2MPhq70Xg0Xf1FniDlihQ4k7T4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auth helper functions
export const getCurrentUserId = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
};

export const getCurrentUser = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
};

// Database interfaces remain the same
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