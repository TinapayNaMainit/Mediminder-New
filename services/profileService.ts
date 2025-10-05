import { supabase } from './supabaseClient';

export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export const profileService = {
  // Get current user's profile
  async getCurrentProfile(): Promise<UserProfile | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return null;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return await this.createProfile(session.user.id);
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error getting profile:', error);
      return null;
    }
  },

  // Create profile for user
  async createProfile(userId: string): Promise<UserProfile | null> {
    try {
      const randomUsername = `user${Math.floor(Math.random() * 999999 + 100000)}`;
      
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          display_name: randomUsername,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating profile:', error);
      return null;
    }
  },

  // Update profile
  async updateProfile(updates: Partial<Pick<UserProfile, 'display_name' | 'avatar_url'>>): Promise<UserProfile | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return null;

      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', session.user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating profile:', error);
      return null;
    }
  },

  // Upload avatar image
  async uploadAvatar(uri: string): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return null;

      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;
      
      // Read file as ArrayBuffer
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (error) {
        console.error('Storage upload error:', error);
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      return null;
    }
  },

  // Generate avatar initials
  getInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  },

  // Generate random avatar color based on name
  getAvatarColor(name: string): string {
    const colors = [
      '#667EEA', '#764BA2', '#6366F1', '#8B5CF6',
      '#10B981', '#059669', '#F59E0B', '#D97706',
      '#EF4444', '#DC2626', '#8B5A2B', '#92400E'
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }
};