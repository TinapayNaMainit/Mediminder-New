// services/medicationEnhancedService.ts
import { supabase } from './supabaseClient';
import { Alert } from 'react-native';

// =====================================
// 2. MISSED DOSE AUTO ADJUSTMENT
// =====================================
export const missedDoseService = {
  // Auto-adjust next dose time based on missed dose
  async adjustNextDose(medicationId: string, missedTime: string): Promise<boolean> {
    try {
      const { data: medication } = await supabase
        .from('medications')
        .select('reminder_time, frequency')
        .eq('id', medicationId)
        .single();

      if (!medication) return false;

      // Calculate new reminder time based on frequency
      const [missedHour, missedMinute] = missedTime.split(':').map(Number);
      let newHour = missedHour;
      let newMinute = missedMinute;

      // Adjust based on frequency
      switch (medication.frequency) {
        case 'Once daily':
          // Keep same time tomorrow
          break;
        case 'Twice daily':
          newHour = (missedHour + 12) % 24;
          break;
        case 'Three times daily':
          newHour = (missedHour + 8) % 24;
          break;
        case 'Four times daily':
          newHour = (missedHour + 6) % 24;
          break;
        default:
          // For other frequencies, suggest taking as soon as possible
          const now = new Date();
          newHour = now.getHours();
          newMinute = now.getMinutes() + 30; // 30 minutes from now
          if (newMinute >= 60) {
            newHour = (newHour + 1) % 24;
            newMinute = newMinute % 60;
          }
      }

      const newTime = `${String(newHour).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}:00`;

      // Update medication reminder time
      const { error } = await supabase
        .from('medications')
        .update({ 
          reminder_time: newTime,
          updated_at: new Date().toISOString()
        })
        .eq('id', medicationId);

      if (error) throw error;

      Alert.alert(
        'Reminder Adjusted',
        `Next dose reminder moved to ${String(newHour).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`,
        [{ text: 'OK' }]
      );

      return true;
    } catch (error) {
      console.error('Error adjusting dose:', error);
      return false;
    }
  },

  // Suggest makeup dose time
  suggestMakeupDose(originalTime: string, frequency: string): string {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Suggest taking it ASAP if within safe window
    const makeupHour = currentHour;
    const makeupMinute = currentMinute + 30;

    return `${String(makeupHour).padStart(2, '0')}:${String(makeupMinute % 60).padStart(2, '0')}`;
  }
};

// =====================================
// 3. TRACK PILLS LEFT & REFILL ALERTS
// =====================================
export const inventoryService = {
  // Calculate days until medication runs out
  async getDaysUntilEmpty(medicationId: string): Promise<number> {
    try {
      const { data: medication } = await supabase
        .from('medications')
        .select('current_quantity, frequency')
        .eq('id', medicationId)
        .single();

      if (!medication) return 0;

      const currentQty = medication.current_quantity;
      let dailyUsage = 1; // Default

      // Calculate daily usage based on frequency
      switch (medication.frequency) {
        case 'Once daily': dailyUsage = 1; break;
        case 'Twice daily': dailyUsage = 2; break;
        case 'Three times daily': dailyUsage = 3; break;
        case 'Four times daily': dailyUsage = 4; break;
        case 'Every 4 hours': dailyUsage = 6; break;
        case 'Every 6 hours': dailyUsage = 4; break;
        case 'Every 8 hours': dailyUsage = 3; break;
        case 'Every 12 hours': dailyUsage = 2; break;
        default: dailyUsage = 1;
      }

      return Math.floor(currentQty / dailyUsage);
    } catch (error) {
      console.error('Error calculating days until empty:', error);
      return 0;
    }
  },

  // Check and send refill alerts
  async checkRefillAlerts(userId: string): Promise<void> {
    try {
      const { data: medications } = await supabase
        .from('medications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .gt('low_stock_threshold', 0);

      if (!medications) return;

      const lowStockMeds = medications.filter(med => 
        med.current_quantity <= med.low_stock_threshold && med.current_quantity > 0
      );

      for (const med of lowStockMeds) {
        const daysLeft = await this.getDaysUntilEmpty(med.id);
        
        if (daysLeft <= 7) {
          Alert.alert(
            '🔔 Refill Alert',
            `${med.medication_name} is running low!\n\nCurrent: ${med.current_quantity} ${med.dosage_unit}\nDays left: ~${daysLeft}\n\nTime to refill!`,
            [
              { text: 'Remind Later', style: 'cancel' },
              { text: 'Order Refill', onPress: () => this.initiateRefill(med) }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error checking refill alerts:', error);
    }
  },

  // Initiate refill process
  async initiateRefill(medication: any): Promise<void> {
    // This would integrate with pharmacy APIs in production
    Alert.alert(
      'Refill Request',
      `Refill for ${medication.medication_name} will be processed.\n\nIn production, this would:\n• Contact your pharmacy\n• Check insurance coverage\n• Place refill order`,
      [{ text: 'OK' }]
    );

    // Log refill request
    await supabase
      .from('refill_requests')
      .insert({
        medication_id: medication.id,
        user_id: medication.user_id,
        requested_at: new Date().toISOString(),
        status: 'pending',
        quantity_requested: medication.total_quantity
      });
  },

  // Auto-decrement pill count on "take" action
  async decrementPillCount(medicationId: string): Promise<void> {
    try {
      const { data: medication } = await supabase
        .from('medications')
        .select('current_quantity, medication_name, low_stock_threshold')
        .eq('id', medicationId)
        .single();

      if (!medication || medication.current_quantity <= 0) return;

      const newQuantity = medication.current_quantity - 1;

      await supabase
        .from('medications')
        .update({ 
          current_quantity: newQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', medicationId);

      // Check if low stock
      if (newQuantity <= medication.low_stock_threshold) {
        Alert.alert(
          '⚠️ Low Stock',
          `${medication.medication_name} is running low: ${newQuantity} remaining`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error decrementing pill count:', error);
    }
  }
};

// =====================================
// 4. ALLERGY & DRUG INTERACTION DETECTION
// =====================================

// Drug interaction database (simplified - in production use FDA API)
const DRUG_INTERACTIONS: { [key: string]: string[] } = {
  'aspirin': ['warfarin', 'ibuprofen', 'naproxen'],
  'warfarin': ['aspirin', 'ibuprofen', 'vitamin k'],
  'metformin': ['alcohol', 'insulin'],
  'lisinopril': ['potassium', 'ibuprofen'],
  'omeprazole': ['clopidogrel', 'methotrexate'],
  'simvastatin': ['grapefruit', 'amlodipine', 'diltiazem'],
};

export const safetyService = {
  // Check for drug interactions
  async checkDrugInteractions(medications: any[]): Promise<string[]> {
    const interactions: string[] = [];
    
    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const med1 = medications[i].medication_name.toLowerCase();
        const med2 = medications[j].medication_name.toLowerCase();

        // Check both directions
        if (DRUG_INTERACTIONS[med1]?.includes(med2)) {
          interactions.push(
            `⚠️ Interaction: ${medications[i].medication_name} may interact with ${medications[j].medication_name}`
          );
        }
      }
    }

    return interactions;
  },

  // Check user allergies against medications
  async checkAllergies(userId: string, medicationName: string): Promise<boolean> {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('allergies')
        .eq('user_id', userId)
        .single();

      if (!profile?.allergies) return false;

      const allergies = profile.allergies.toLowerCase().split(',').map((a: string) => a.trim());
      const medLower = medicationName.toLowerCase();

      for (const allergy of allergies) {
        if (medLower.includes(allergy)) {
          Alert.alert(
            '🚨 ALLERGY ALERT',
            `You have a recorded allergy to: ${allergy}\n\nThis medication may contain this allergen. Please consult your doctor before taking.`,
            [{ text: 'Understood', style: 'destructive' }]
          );
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking allergies:', error);
      return false;
    }
  },

  // Display safety warnings
  async showSafetyWarnings(userId: string): Promise<void> {
    try {
      const { data: medications } = await supabase
        .from('medications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (!medications || medications.length === 0) return;

      const interactions = await this.checkDrugInteractions(medications);

      if (interactions.length > 0) {
        Alert.alert(
          '⚠️ Drug Interactions Detected',
          interactions.join('\n\n'),
          [
            { text: 'Dismiss', style: 'cancel' },
            { text: 'Contact Doctor', onPress: () => { /* Open phone/email */ }}
          ]
        );
      }
    } catch (error) {
      console.error('Error showing safety warnings:', error);
    }
  }
};

// =====================================
// 5. PROPER DISPOSAL OF EXPIRED MEDS
// =====================================
export const disposalService = {
  // Check for expired medications
  async checkExpiredMedications(userId: string): Promise<any[]> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: expired } = await supabase
        .from('medications')
        .select('*')
        .eq('user_id', userId)
        .lt('expiry_date', today);

      return expired || [];
    } catch (error) {
      console.error('Error checking expired medications:', error);
      return [];
    }
  },

  // Get disposal instructions
  getDisposalInstructions(medicationType: string): string {
    const instructions = {
      default: `
🗑️ SAFE DISPOSAL INSTRUCTIONS:

1. DO NOT FLUSH down toilet or drain
2. Remove personal info from bottle
3. Mix with undesirable substance (coffee grounds, dirt)
4. Seal in plastic bag
5. Dispose in household trash

OR

🏥 Take to a medication take-back program:
• Local pharmacy
• DEA take-back events
• Hospital disposal sites

📞 Call 1-800-FDA-1088 for locations
      `,
      controlled: `
⚠️ CONTROLLED SUBSTANCE DISPOSAL:

This medication requires special handling:

1. DO NOT throw in regular trash
2. Take to authorized DEA collection site
3. Use FDA-approved disposal system
4. Call your pharmacy for take-back program

🔒 NEVER give to others
📞 Find location: 1-800-882-9539
      `
    };

    return instructions[medicationType as keyof typeof instructions] || instructions.default;
  },

  // Alert user about expired medications
  async alertExpiredMedications(userId: string): Promise<void> {
    const expired = await this.checkExpiredMedications(userId);

    if (expired.length > 0) {
      const expiredList = expired.map(med => 
        `• ${med.medication_name} (Expired: ${new Date(med.expiry_date).toLocaleDateString()})`
      ).join('\n');

      Alert.alert(
        '🚨 Expired Medications Detected',
        `The following medications have expired:\n\n${expiredList}\n\nThese should be disposed of properly.`,
        [
          { text: 'Later', style: 'cancel' },
          { 
            text: 'Disposal Guide', 
            onPress: () => this.showDisposalGuide(expired[0]) 
          }
        ]
      );
    }
  },

  // Show disposal guide
  showDisposalGuide(medication: any): void {
    const instructions = this.getDisposalInstructions('default');
    
    Alert.alert(
      `Disposal Guide: ${medication.medication_name}`,
      instructions,
      [{ text: 'Understood' }]
    );
  },

  // Mark medication as disposed
  async markAsDisposed(medicationId: string): Promise<void> {
    try {
      await supabase
        .from('medications')
        .update({ 
          is_active: false,
          disposed_at: new Date().toISOString(),
          disposal_method: 'user_reported'
        })
        .eq('id', medicationId);

      Alert.alert('Success', 'Medication marked as disposed');
    } catch (error) {
      console.error('Error marking as disposed:', error);
      Alert.alert('Error', 'Failed to update medication status');
    }
  }
};

// =====================================
// PILL IMAGE RECOGNITION (PLACEHOLDER)
// =====================================
export const pillRecognitionService = {
  // This would use AI/ML model in production (NIH Pillbox API)
  async identifyPill(imageUri: string): Promise<any> {
    try {
      // In production, send to NIH Pillbox API or custom ML model
      // Example: https://pillbox.nlm.nih.gov/
      
      Alert.alert(
        'Pill Recognition',
        'This feature requires integration with NIH Pillbox API or custom ML model.\n\nIt would identify:\n• Medication name\n• Dosage\n• Manufacturer\n• Warnings',
        [{ text: 'OK' }]
      );

      return null;
    } catch (error) {
      console.error('Error identifying pill:', error);
      return null;
    }
  }
};