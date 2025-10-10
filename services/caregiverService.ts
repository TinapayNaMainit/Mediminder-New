// services/caregiverService.ts
import { supabase } from './supabaseClient';

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
  // Generate unique connection code for patient
  async generateConnectionCode(userId: string): Promise<string | null> {
    try {
      // Generate a random 6-character code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          connection_code: code,
          updated_at: new Date().toISOString() 
        })
        .eq('user_id', userId);

      if (error) throw error;
      return code;
    } catch (error) {
      console.error('Error generating connection code:', error);
      return null;
    }
  },

  // Get user's connection code
  async getConnectionCode(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('connection_code')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      
      // Generate new code if none exists
      if (!data?.connection_code) {
        return await this.generateConnectionCode(userId);
      }
      
      return data.connection_code;
    } catch (error) {
      console.error('Error getting connection code:', error);
      return null;
    }
  },

  // Connect caregiver to patient using code
  async connectWithCode(caregiverId: string, connectionCode: string): Promise<boolean> {
    try {
      // Find patient by connection code
      const { data: patientProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id, role')
        .eq('connection_code', connectionCode)
        .single();

      if (profileError || !patientProfile) {
        throw new Error('Invalid connection code');
      }

      if (patientProfile.role !== 'patient') {
        throw new Error('This code belongs to a caregiver account. You can only connect with patients.');
      }

      if (patientProfile.user_id === caregiverId) {
        throw new Error('You cannot connect to yourself');
      }

      // Check if connection already exists
      const { data: existing } = await supabase
        .from('caregiver_connections')
        .select('id')
        .eq('patient_id', patientProfile.user_id)
        .eq('caregiver_id', caregiverId)
        .single();

      if (existing) {
        throw new Error('You are already connected to this patient');
      }

      // Create connection
      const { error: connectionError } = await supabase
        .from('caregiver_connections')
        .insert({
          patient_id: patientProfile.user_id,
          caregiver_id: caregiverId,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (connectionError) throw connectionError;

      return true;
    } catch (error: any) {
      console.error('Error connecting with code:', error);
      throw error;
    }
  },

  // Get all connections for a user
  async getConnections(userId: string): Promise<CaregiverConnection[]> {
    try {
      // First get the connections
      const { data: connections, error: connError } = await supabase
        .from('caregiver_connections')
        .select('*')
        .or(`patient_id.eq.${userId},caregiver_id.eq.${userId}`)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (connError) throw connError;
      if (!connections || connections.length === 0) return [];

      // Get all unique user IDs
      const userIds = new Set<string>();
      connections.forEach(conn => {
        userIds.add(conn.patient_id);
        userIds.add(conn.caregiver_id);
      });

      // Fetch all user profiles
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', Array.from(userIds));

      if (profileError) throw profileError;

      // Map profiles to connections
      const profileMap = new Map();
      profiles?.forEach(profile => {
        profileMap.set(profile.user_id, profile);
      });

      // Combine data
      const result = connections.map(conn => ({
        ...conn,
        patient_profile: profileMap.get(conn.patient_id),
        caregiver_profile: profileMap.get(conn.caregiver_id),
      }));

      return result;
    } catch (error) {
      console.error('Error getting connections:', error);
      return [];
    }
  },

  // Remove connection
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
      console.error('Error removing connection:', error);
      return false;
    }
  },

  // Check if user is a caregiver with access to patient
  async hasAccessToPatient(caregiverId: string, patientId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('caregiver_connections')
        .select('id')
        .eq('caregiver_id', caregiverId)
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .single();

      return !error && !!data;
    } catch (error) {
      return false;
    }
  },

  // Get patients that caregiver has access to
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
        ...conn.patient_profile
      })) || [];
    } catch (error) {
      console.error('Error getting patients:', error);
      return [];
    }
  },
};