// services/caregiverService.ts - FIXED VERSION
import { supabase } from './supabaseClient';
import { Alert } from 'react-native';

export interface CaregiverConnection {
  id: string;
  patient_id: string;
  caregiver_id: string;
  status: 'pending' | 'active' | 'revoked';
  created_at: string;
  updated_at: string;
  patient_profile?: {
    display_name: string;
    avatar_url?: string;
  };
  caregiver_profile?: {
    display_name: string;
    avatar_url?: string;
  };
}

export const caregiverService = {
  // ✅ FIX 1: Generate unique connection code for patient
  async generateConnectionCode(userId: string): Promise<string | null> {
    try {
      // Generate a random 6-character alphanumeric code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      console.log('🔑 Generating connection code:', code, 'for user:', userId);
      
      // ✅ FIX: Use upsert to avoid conflicts
      const { error } = await supabase
        .from('user_profiles')
        .upsert({ 
          user_id: userId,
          connection_code: code,
          updated_at: new Date().toISOString() 
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('❌ Error generating code:', error);
        throw error;
      }

      console.log('✅ Connection code generated successfully');
      return code;
    } catch (error) {
      console.error('❌ Error in generateConnectionCode:', error);
      return null;
    }
  },

  // ✅ FIX 2: Get user's connection code (create if doesn't exist)
  async getConnectionCode(userId: string): Promise<string | null> {
    try {
      console.log('📖 Getting connection code for user:', userId);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('connection_code')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('❌ Error fetching code:', error);
        // If profile doesn't exist, create it
        if (error.code === 'PGRST116') {
          console.log('📝 Profile not found, creating new one...');
          return await this.generateConnectionCode(userId);
        }
        throw error;
      }
      
      // Generate new code if none exists
      if (!data?.connection_code) {
        console.log('📝 No code found, generating new one...');
        return await this.generateConnectionCode(userId);
      }
      
      console.log('✅ Found existing code:', data.connection_code);
      return data.connection_code;
    } catch (error) {
      console.error('❌ Error in getConnectionCode:', error);
      return null;
    }
  },

  // ✅ FIX 3: Connect caregiver to patient using code (IMPROVED)
  async connectWithCode(caregiverId: string, connectionCode: string): Promise<boolean> {
    try {
      const trimmedCode = connectionCode.trim().toUpperCase();
      console.log('🔗 Attempting connection...');
      console.log('   Caregiver ID:', caregiverId);
      console.log('   Connection Code:', trimmedCode);

      // ✅ FIX: First verify caregiver profile exists and has correct role
      const { data: caregiverProfile, error: caregiverError } = await supabase
        .from('user_profiles')
        .select('user_id, role, display_name')
        .eq('user_id', caregiverId)
        .single();

      if (caregiverError || !caregiverProfile) {
        console.error('❌ Caregiver profile not found');
        throw new Error('Caregiver profile not found. Please complete your profile setup.');
      }

      if (caregiverProfile.role !== 'caregiver') {
        console.error('❌ User is not a caregiver');
        throw new Error('Only caregivers can connect to patients. Please check your role.');
      }

      console.log('✅ Caregiver verified:', caregiverProfile.display_name);

      // ✅ FIX: Find patient by connection code with better error handling
      const { data: patientProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id, role, display_name')
        .eq('connection_code', trimmedCode)
        .single();

      if (profileError) {
        console.error('❌ Database error finding patient:', profileError);
        if (profileError.code === 'PGRST116') {
          throw new Error('Invalid connection code. Please check the code and try again.');
        }
        throw new Error('Error finding patient. Please try again.');
      }

      if (!patientProfile) {
        console.error('❌ No patient found with code:', trimmedCode);
        throw new Error('Invalid connection code. Please verify the code is correct.');
      }

      console.log('✅ Patient found:', patientProfile.display_name);

      // ✅ FIX: Validate patient role
      if (patientProfile.role !== 'patient') {
        console.error('❌ Code belongs to a caregiver');
        throw new Error('This code belongs to a caregiver. You can only connect with patients.');
      }

      // ✅ FIX: Prevent self-connection
      if (patientProfile.user_id === caregiverId) {
        console.error('❌ Cannot connect to self');
        throw new Error('You cannot connect to yourself.');
      }

      // ✅ FIX: Check if connection already exists (active or pending)
      const { data: existing, error: existingError } = await supabase
        .from('caregiver_connections')
        .select('id, status')
        .eq('patient_id', patientProfile.user_id)
        .eq('caregiver_id', caregiverId)
        .in('status', ['active', 'pending'])
        .maybeSingle();

      if (existingError) {
        console.error('❌ Error checking existing connection:', existingError);
        throw new Error('Error checking existing connections. Please try again.');
      }

      if (existing) {
        console.warn('⚠️ Connection already exists:', existing.status);
        throw new Error(`You are already ${existing.status === 'active' ? 'connected to' : 'pending connection with'} this patient.`);
      }

      // ✅ FIX: Create connection with proper error handling
      console.log('📝 Creating new connection...');
      const { data: newConnection, error: connectionError } = await supabase
        .from('caregiver_connections')
        .insert({
          patient_id: patientProfile.user_id,
          caregiver_id: caregiverId,
          status: 'active', // Set directly to active
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (connectionError) {
        console.error('❌ Error creating connection:', connectionError);
        throw new Error('Failed to create connection. Please try again.');
      }

      console.log('✅ Connection created successfully:', newConnection.id);
      return true;
    } catch (error: any) {
      console.error('❌ Connection failed:', error);
      throw error; // Re-throw to preserve error message
    }
  },

  // ✅ FIX 4: Get all connections for a user (IMPROVED)
  async getConnections(userId: string): Promise<CaregiverConnection[]> {
    try {
      console.log('📋 Fetching connections for user:', userId);

      // Get connections with proper joins
      const { data: connections, error: connError } = await supabase
        .from('caregiver_connections')
        .select(`
          *,
          patient_profile:user_profiles!caregiver_connections_patient_id_fkey(
            user_id,
            display_name,
            avatar_url
          ),
          caregiver_profile:user_profiles!caregiver_connections_caregiver_id_fkey(
            user_id,
            display_name,
            avatar_url
          )
        `)
        .or(`patient_id.eq.${userId},caregiver_id.eq.${userId}`)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (connError) {
        console.error('❌ Error fetching connections:', connError);
        throw connError;
      }

      console.log(`✅ Found ${connections?.length || 0} connections`);
      return connections || [];
    } catch (error) {
      console.error('❌ Error in getConnections:', error);
      return [];
    }
  },

  // Remove connection
  async removeConnection(connectionId: string): Promise<boolean> {
    try {
      console.log('🗑️ Removing connection:', connectionId);

      const { error } = await supabase
        .from('caregiver_connections')
        .update({ 
          status: 'revoked',
          updated_at: new Date().toISOString() 
        })
        .eq('id', connectionId);

      if (error) {
        console.error('❌ Error removing connection:', error);
        throw error;
      }

      console.log('✅ Connection removed successfully');
      return true;
    } catch (error) {
      console.error('❌ Error in removeConnection:', error);
      return false;
    }
  },

  // ✅ FIX 5: Check if user is a caregiver with access to patient
  async hasAccessToPatient(caregiverId: string, patientId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('caregiver_connections')
        .select('id')
        .eq('caregiver_id', caregiverId)
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('❌ Error checking access:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('❌ Error in hasAccessToPatient:', error);
      return false;
    }
  },

  // ✅ FIX 6: Get patients that caregiver has access to
  async getPatientsForCaregiver(caregiverId: string): Promise<any[]> {
    try {
      console.log('👥 Fetching patients for caregiver:', caregiverId);

      const { data, error } = await supabase
        .from('caregiver_connections')
        .select(`
          patient_id,
          patient_profile:user_profiles!caregiver_connections_patient_id_fkey(
            user_id,
            display_name,
            avatar_url
          )
        `)
        .eq('caregiver_id', caregiverId)
        .eq('status', 'active');

      if (error) {
        console.error('❌ Error fetching patients:', error);
        throw error;
      }
      
      const patients = data?.map(conn => ({
        id: conn.patient_id,
        ...(conn.patient_profile || {})
      })) || [];

      console.log(`✅ Found ${patients.length} patients`);
      return patients;
    } catch (error) {
      console.error('❌ Error in getPatientsForCaregiver:', error);
      return [];
    }
  },

  // ✅ NEW: Caregiver CRUD operations for patient medications

  // Get patient's medications (caregiver access)
  async getPatientMedications(caregiverId: string, patientId: string): Promise<any[]> {
    try {
      // Verify access first
      const hasAccess = await this.hasAccessToPatient(caregiverId, patientId);
      if (!hasAccess) {
        console.error('❌ No access to patient medications');
        Alert.alert('Access Denied', 'You do not have permission to view this patient\'s medications.');
        return [];
      }

      console.log('📋 Fetching patient medications...');

      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('user_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log(`✅ Found ${data?.length || 0} medications`);
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching patient medications:', error);
      return [];
    }
  },

  // Add medication for patient (caregiver access)
  async addPatientMedication(
    caregiverId: string,
    patientId: string,
    medicationData: any
  ): Promise<boolean> {
    try {
      const hasAccess = await this.hasAccessToPatient(caregiverId, patientId);
      if (!hasAccess) {
        Alert.alert('Access Denied', 'You do not have permission to add medications for this patient.');
        return false;
      }

      console.log('➕ Adding medication for patient...');

      const { error } = await supabase
        .from('medications')
        .insert({
          ...medicationData,
          user_id: patientId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      console.log('✅ Medication added successfully');
      return true;
    } catch (error) {
      console.error('❌ Error adding medication:', error);
      Alert.alert('Error', 'Failed to add medication');
      return false;
    }
  },

  // Update patient's medication (caregiver access)
  async updatePatientMedication(
    caregiverId: string,
    patientId: string,
    medicationId: string,
    updates: any
  ): Promise<boolean> {
    try {
      const hasAccess = await this.hasAccessToPatient(caregiverId, patientId);
      if (!hasAccess) {
        Alert.alert('Access Denied', 'You do not have permission to update this medication.');
        return false;
      }

      console.log('✏️ Updating medication...');

      const { error } = await supabase
        .from('medications')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', medicationId)
        .eq('user_id', patientId);

      if (error) throw error;

      console.log('✅ Medication updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Error updating medication:', error);
      Alert.alert('Error', 'Failed to update medication');
      return false;
    }
  },

  // Delete patient's medication (caregiver access)
  async deletePatientMedication(
    caregiverId: string,
    patientId: string,
    medicationId: string
  ): Promise<boolean> {
    try {
      const hasAccess = await this.hasAccessToPatient(caregiverId, patientId);
      if (!hasAccess) {
        Alert.alert('Access Denied', 'You do not have permission to delete this medication.');
        return false;
      }

      console.log('🗑️ Deleting medication...');

      const { error } = await supabase
        .from('medications')
        .delete()
        .eq('id', medicationId)
        .eq('user_id', patientId);

      if (error) throw error;

      console.log('✅ Medication deleted successfully');
      return true;
    } catch (error) {
      console.error('❌ Error deleting medication:', error);
      Alert.alert('Error', 'Failed to delete medication');
      return false;
    }
  },

  // Get patient's medication logs (caregiver access)
  async getPatientMedicationLogs(
    caregiverId: string,
    patientId: string,
    medicationId?: string
  ): Promise<any[]> {
    try {
      const hasAccess = await this.hasAccessToPatient(caregiverId, patientId);
      if (!hasAccess) {
        return [];
      }

      console.log('📊 Fetching medication logs...');

      let query = supabase
        .from('medication_logs')
        .select('*')
        .eq('user_id', patientId)
        .order('log_date', { ascending: false });

      if (medicationId) {
        query = query.eq('medication_id', medicationId);
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log(`✅ Found ${data?.length || 0} logs`);
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching logs:', error);
      return [];
    }
  }
};