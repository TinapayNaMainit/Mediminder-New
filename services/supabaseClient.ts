import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase project credentials
const supabaseUrl = 'https://yohyvjvhipztuchccinx.supabase.co'; // e.g., 'https://xyzcompany.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvaHl2anZoaXB6dHVjaGNjaW54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2Nzg3MjgsImV4cCI6MjA3NDI1NDcyOH0.fCw9ogLvrDMwdWFtM2MPhq70Xg0Xf1FniDlihQ4k7T4'; // Your anon/public key

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Types matching your database schema
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

export interface DatabaseUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  ai_companion_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Helper functions
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