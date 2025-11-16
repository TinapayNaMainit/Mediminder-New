// services/caregiverService.ts - FIXED CONNECTION CODE GENERATION
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
  // ✅ FIXED: Generate unique connection code with better error handling
  async generateConnectionCode(userId: string): Promise<string | null> {
    try {
      console.log('🔑 Generating connection code for user:', userId);
      
      // Generate a random 6-character alphanumeric code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      console.log('   Generated code:', code);
      
      // ✅ FIX 1: First check if profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('user_profiles')
        .select('id, user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (checkError) {
        console.error('❌ Error checking profile:', checkError);
        throw new Error('Failed to check profile: ' + checkError.message);
      }

      if (existingProfile) {
        // Profile exists - update it
        console.log('   Profile exists, updating...');
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ 
            connection_code: code,
            updated_at: new Date().toISOString() 
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('❌ Error updating code:', updateError);
          throw new Error('Failed to update code: ' + updateError.message);
        }
      } else {
        // Profile doesn't exist - create it
        console.log('   Profile does not exist, creating...');
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: userId,
            display_name: `user${Math.floor(Math.random() * 999999 + 100000)}`,
            connection_code: code,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('❌ Error creating profile:', insertError);
          throw new Error('Failed to create profile: ' + insertError.message);
        }
      }

      console.log('✅ Connection code saved successfully');
      return code;
    } catch (error: any) {
      console.error('❌ Error in generateConnectionCode:', error);
      Alert.alert('Error', error.message || 'Failed to generate connection code');
      return null;
    }
  },

  // ✅ FIXED: Get connection code with better error handling
  async getConnectionCode(userId: string): Promise<string | null> {
    try {
      console.log('📖 Getting connection code for user:', userId);
      
      // ✅ FIX: Use maybeSingle() instead of single() to avoid errors
      const { data, error } = await supabase
        .from('user_profiles')
        .select('connection_code, user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ Database error:', error);
        throw new Error('Database error: ' + error.message);
      }
      
      // If no profile or no code, generate new one
      if (!data || !data.connection_code) {
        console.log('📝 No code found, generating new one...');
        return await this.generateConnectionCode(userId);
      }
      
      console.log('✅ Found existing code');
      return data.connection_code;
    } catch (error: any) {
      console.error('❌ Error in getConnectionCode:', error);
      Alert.alert('Error', error.message || 'Failed to get connection code');
      return null;
    }
  },

  // ✅ FIXED: Better connection validation
  async connectWithCode(caregiverId: string, connectionCode: string): Promise<boolean> {
    try {
      const trimmedCode = connectionCode.trim().toUpperCase();
      console.log('🔗 Attempting connection...');
      console.log('   Caregiver ID:', caregiverId);
      console.log('   Connection Code:', trimmedCode);

      // Verify caregiver profile
      const { data: caregiverProfile, error: caregiverError } = await supabase
        .from('user_profiles')
        .select('user_id, role, display_name')
        .eq('user_id', caregiverId)
        .maybeSingle();

      if (caregiverError || !caregiverProfile) {
        throw new Error('Caregiver profile not found. Please complete your profile setup.');
      }

      if (caregiverProfile.role !== 'caregiver') {
        throw new Error('Only caregivers can connect to patients.');
      }

      console.log('✅ Caregiver verified:', caregiverProfile.display_name);

      // Find patient by connection code
      const { data: patientProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id, role, display_name')
        .eq('connection_code', trimmedCode)
        .maybeSingle();

      if (profileError) {
        console.error('❌ Database error:', profileError);
        throw new Error('Error finding patient: ' + profileError.message);
      }

      if (!patientProfile) {
        throw new Error('Invalid connection code. Please verify the code is correct.');
      }

      console.log('✅ Patient found:', patientProfile.display_name);

      if (patientProfile.role !== 'patient') {
        throw new Error('This code belongs to a caregiver. You can only connect with patients.');
      }

      if (patientProfile.user_id === caregiverId) {
        throw new Error('You cannot connect to yourself.');
      }

      // Check existing connection
      const { data: existing, error: existingError } = await supabase
        .from('caregiver_connections')
        .select('id, status')
        .eq('patient_id', patientProfile.user_id)
        .eq('caregiver_id', caregiverId)
        .in('status', ['active', 'pending'])
        .maybeSingle();

      if (existingError) {
        console.error('❌ Error checking connection:', existingError);
        throw new Error('Error checking connections: ' + existingError.message);
      }

      if (existing) {
        throw new Error(`You are already ${existing.status === 'active' ? 'connected to' : 'pending connection with'} this patient.`);
      }

      // Create connection
      console.log('📝 Creating new connection...');
      const { data: newConnection, error: connectionError } = await supabase
        .from('caregiver_connections')
        .insert({
          patient_id: patientProfile.user_id,
          caregiver_id: caregiverId,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (connectionError) {
        console.error('❌ Error creating connection:', connectionError);
        throw new Error('Failed to create connection: ' + connectionError.message);
      }

      console.log('✅ Connection created successfully');
      return true;
    } catch (error: any) {
      console.error('❌ Connection failed:', error);
      throw error;
    }
  },

  // Get all connections (unchanged)
  async getConnections(userId: string): Promise<CaregiverConnection[]> {
    try {
      const { data: connections, error } = await supabase
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

      if (error) throw error;
      return connections || [];
    } catch (error) {
      console.error('Error in getConnections:', error);
      return [];
    }
  },

  // Remove connection (unchanged)
  async removeConnection(connectionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('caregiver_connections')
        .update({ 
          status: 'revoked',
          updated_at: new Date().toISOString() 
        })
        .eq('id', connectionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error in removeConnection:', error);
      return false;
    }
  },

  // Check access (unchanged)
  async hasAccessToPatient(caregiverId: string, patientId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('caregiver_connections')
        .select('id')
        .eq('caregiver_id', caregiverId)
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .maybeSingle();

      return !!data;
    } catch (error) {
      return false;
    }
  },

  // Get patients for caregiver (unchanged)
  async getPatientsForCaregiver(caregiverId: string): Promise<any[]> {
    try {
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

      if (error) throw error;
      
      return data?.map(conn => ({
        id: conn.patient_id,
        ...(conn.patient_profile || {})
      })) || [];
    } catch (error) {
      return [];
    }
  },

  // Medication management methods (unchanged from your original)
  async getPatientMedications(caregiverId: string, patientId: string): Promise<any[]> {
    try {
      const hasAccess = await this.hasAccessToPatient(caregiverId, patientId);
      if (!hasAccess) {
        Alert.alert('Access Denied', 'You do not have permission to view this patient\'s medications.');
        return [];
      }

      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('user_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching patient medications:', error);
      return [];
    }
  },

  async addPatientMedication(caregiverId: string, patientId: string, medicationData: any): Promise<boolean> {
    try {
      const hasAccess = await this.hasAccessToPatient(caregiverId, patientId);
      if (!hasAccess) {
        Alert.alert('Access Denied', 'You do not have permission to add medications.');
        return false;
      }

      const { error } = await supabase
        .from('medications')
        .insert({
          ...medicationData,
          user_id: patientId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to add medication');
      return false;
    }
  },

  async updatePatientMedication(caregiverId: string, patientId: string, medicationId: string, updates: any): Promise<boolean> {
    try {
      const hasAccess = await this.hasAccessToPatient(caregiverId, patientId);
      if (!hasAccess) {
        Alert.alert('Access Denied', 'You do not have permission to update this medication.');
        return false;
      }

      const { error } = await supabase
        .from('medications')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', medicationId)
        .eq('user_id', patientId);

      if (error) throw error;
      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to update medication');
      return false;
    }
  },

  async deletePatientMedication(caregiverId: string, patientId: string, medicationId: string): Promise<boolean> {
    try {
      const hasAccess = await this.hasAccessToPatient(caregiverId, patientId);
      if (!hasAccess) {
        Alert.alert('Access Denied', 'You do not have permission to delete this medication.');
        return false;
      }

      const { error } = await supabase
        .from('medications')
        .delete()
        .eq('id', medicationId)
        .eq('user_id', patientId);

      if (error) throw error;
      return true;
    } catch (error) {
      Alert.alert('Error', 'Failed to delete medication');
      return false;
    }
  },

  async getPatientMedicationLogs(caregiverId: string, patientId: string, medicationId?: string): Promise<any[]> {
    try {
      const hasAccess = await this.hasAccessToPatient(caregiverId, patientId);
      if (!hasAccess) return [];

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
      return data || [];
    } catch (error) {
      return [];
    }
  }
};