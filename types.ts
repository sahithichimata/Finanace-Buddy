
export interface LineItem {
  name: string;
  quantity: number;
  price: number;
}

export interface DecisionPath {
  tokens: string[];
  weights: Record<string, number>;
  structuralBias: {
    dining: number;
    grocery: number;
    merchantSuffix: number;
  };
  finalScores: Record<string, number>;
}

export interface InferenceResult {
  category: string;
  confidence: number;
  decisionPath: DecisionPath;
}

export interface ExtractedReceiptData {
  merchantName: string;
  totalAmount: number;
  transactionDate: string; // YYYY-MM-DD
  category: string; // e.g., "Food & Dining", "Transport"
  items: LineItem[];
  notes?: string;
  confidence?: number; // ML Confidence score
  isVerified?: boolean; // User confirmed categorization
  imageHash?: string; // Perceptual hash for duplicate detection
  duplicateOf?: string; // Original transaction ID if detected
  inferenceDetails?: DecisionPath; // Debugging/Visualization data
  
  // Currency conversion fields
  currency?: string; // Detected currency code (e.g., "USD", "INR")
  baseCurrency?: string; // User's preferred currency at time of upload
  exchangeRate?: number; // Rate used for conversion (1 detected = X base)
  convertedAmount?: number; // Amount in base currency
  conversionTimestamp?: string; // ISO string
}

export interface ReceiptData extends ExtractedReceiptData {
    id: string;
}

export interface Category {
    id: string;
    name: string;
    icon: string; // Emoji or icon identifier
}

export type Page = 
    | 'dashboard' 
    | 'receipts' 
    | 'addReceipt' 
    | 'reports' 
    | 'categories' 
    | 'financeBuddy' 
    | 'plan'
    | 'profile';

export interface ChatMessage {
    sender: 'user' | 'ai';
    text: string;
    evidenceIds?: string[];
}

export interface FixedBill {
    id: string;
    name: string;
    amount: number;
}

export interface UserSettings {
    userName: string;
    budget: number;
    currency: string;
    income: number;
    savings: number;
    fixedBills: FixedBill[];
    isPrivacyMode: boolean;
    pinCode?: string;
    autoLockMinutes?: number;
    isOnboarded: boolean;
    savingsGoal: number;
    isBufferEnabled: boolean;
    bufferAmount: number;
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
