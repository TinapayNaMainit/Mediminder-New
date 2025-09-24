export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  ai_companion_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Medication {
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

export interface MedicationLog {
  id: string;
  medication_id: string;
  user_id: string;
  log_date: string;
  status: 'taken' | 'missed' | 'skipped';
  notes?: string;
  logged_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}