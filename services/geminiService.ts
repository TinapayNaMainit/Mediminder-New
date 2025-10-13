// services/geminiService.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

// Replace with your actual Gemini API key
const GEMINI_API_KEY = 'AIzaSyDRxuVdWkM_bgiq6-fuAPRSNjDAZeMMmVc';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

class GeminiService {
  private model: any;
  private chatHistory: ChatMessage[] = [];

  constructor() {
    this.model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash', // Updated to current model name
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });
  }

  async sendMessage(userMessage: string, medicationContext?: any[]): Promise<ChatMessage> {
    try {
      // Add user message to history
      const userChatMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
      };
      this.chatHistory.push(userChatMessage);

      // Build context-aware prompt
      let prompt = this.buildPrompt(userMessage, medicationContext);

      // Generate response
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Add assistant message to history
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: text,
        timestamp: new Date().toISOString(),
      };
      this.chatHistory.push(assistantMessage);

      return assistantMessage;
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      throw new Error('Failed to get response from AI assistant');
    }
  }

  private buildPrompt(userMessage: string, medicationContext?: any[]): string {
    let context = `You are MedCompanion, a helpful and friendly AI assistant specialized in medication management and health guidance. 
You provide accurate, empathetic, and easy-to-understand information about medications, health tracking, and wellness.

Important guidelines:
- Always remind users that you're an AI assistant and not a replacement for professional medical advice
- For serious medical concerns, advise users to consult their healthcare provider
- Be supportive and encouraging about medication adherence
- Provide clear, concise answers
- Use emojis sparingly to make responses friendly
- Never prescribe medications or dosages

`;

    // Add medication context if available
    if (medicationContext && medicationContext.length > 0) {
      context += `\nUser's Current Medications:\n`;
      medicationContext.forEach((med: any) => {
        context += `- ${med.medication_name}: ${med.dosage}${med.dosage_unit}, ${med.frequency}\n`;
        if (med.notes) context += `  Notes: ${med.notes}\n`;
      });
      context += '\n';
    }

    // Add recent chat history for context (last 5 messages)
    const recentHistory = this.chatHistory.slice(-5);
    if (recentHistory.length > 0) {
      context += 'Recent conversation:\n';
      recentHistory.forEach(msg => {
        context += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
      });
      context += '\n';
    }

    context += `User's current question: ${userMessage}\n\nProvide a helpful, accurate, and friendly response:`;

    return context;
  }

  getChatHistory(): ChatMessage[] {
    return this.chatHistory;
  }

  clearHistory(): void {
    this.chatHistory = [];
  }

  async getSuggestions(): Promise<string[]> {
    return [
      "What should I know about my medications?",
      "Why is medication adherence important?",
      "What are common side effects to watch for?",
      "Tips for remembering to take medications",
      "How to manage multiple medications?",
      "What if I miss a dose?",
    ];
  }
}

export const geminiService = new GeminiService();