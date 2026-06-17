
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from '@google/genai';
import type { ExtractedReceiptData, ReceiptData, UserSettings } from '../types';
import { getCurrencySymbol } from '../utils/currency';
import { detectAnomalies } from './mlService';

import { normalizeMerchantName } from '../utils/merchantNormalization';

let aiInstance: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY || 
                   process.env.API_KEY || 
                   (import.meta as any).env?.VITE_GEMINI_API_KEY || 
                   (import.meta as any).env?.VITE_API_KEY;
                   
    if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
      throw new Error("Gemini API Key is missing. Please ensure you have set the GEMINI_API_KEY or API_KEY environment variable.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

const receiptSchema = {
  type: Type.OBJECT,
  properties: {
    merchantName: { type: Type.STRING, description: "Name of the merchant" },
    totalAmount: { type: Type.NUMBER, description: "Total amount spent" },
    transactionDate: { type: Type.STRING, description: "Date of transaction in YYYY-MM-DD format" },
    currency: { type: Type.STRING, description: "3-letter ISO currency code (e.g., USD, INR, EUR, GBP)" },
    category: { type: Type.STRING, description: "A single-word category for this receipt (e.g., Groceries, Dining, Transport, Entertainment, Healthcare, Utilities, Shopping, Others)" },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of the item" },
          quantity: { type: Type.INTEGER, description: "Quantity of the item" },
          price: { type: Type.NUMBER, description: "Price of the item" },
        },
        required: ['name', 'quantity', 'price'],
      },
    },
  },
  required: ['merchantName', 'totalAmount', 'transactionDate', 'items', 'currency', 'category'],
};

export async function extractReceiptData(
  base64Image: string,
  mimeType: string,
  history: ReceiptData[] = [],
  existingCategories: string[] = []
): Promise<ExtractedReceiptData> {
  const today = new Date().toISOString().split('T')[0];
  const categoriesList = existingCategories.length > 0 ? existingCategories.join(', ') : 'Groceries, Dining, Transport, Entertainment, Healthcare, Utilities, Shopping, Others';
  
  const imagePart = { inlineData: { data: base64Image, mimeType } };
  const textPart = { text: `You are an expert OCR system. Extract all data from this receipt image into the provided JSON schema. Ensure date is YYYY-MM-DD. If date is missing or unclear, use ${today}. Detect the currency used in the receipt and provide the 3-letter ISO currency code (e.g., USD, INR, EUR). 
  
  Categorize the receipt into one of these categories if they fit: ${categoriesList}. If none fit well, you may create a new single-word category.
  
  If items are hard to read, provide best effort summary. Always return valid JSON.` };

  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [textPart, imagePart] },
        config: { 
            responseMimeType: 'application/json', 
            responseSchema: receiptSchema,
            temperature: 0.1
        },
      });
      
      const text = response.text;
      
      if (!text) {
        throw new Error("Gemini returned an empty response.");
      }

      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(cleanJson);
      data.merchantName = normalizeMerchantName(data.merchantName, history);
      data.items = data.items || [];
      return data as ExtractedReceiptData;
    } catch (err: any) {
      lastError = err;
      const isServiceUnavailable = err.message?.includes("503") || err.message?.includes("high demand") || err.status === 503;
      
      if (isServiceUnavailable && attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Gemini busy (503). Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      break;
    }
  }

  console.error("OCR extraction error:", lastError);
  
  if (lastError.message?.includes("503") || lastError.message?.includes("high demand")) {
      throw new Error("The AI service is currently experiencing high demand. Please wait 10-20 seconds and try again.");
  }
  if (lastError.message?.includes("API_KEY_INVALID")) {
      throw new Error("The API key provided is invalid. Please check your Gemini API key.");
  }
  if (lastError.message?.includes("quota")) {
      throw new Error("Gemini API quota exceeded. Please try again later.");
  }
  if (lastError.message?.includes("JSON")) {
      throw new Error("Could not parse receipt data. Please try a clearer photo.");
  }
  
  throw lastError;
}

export async function extractReceiptDataFromQr(
  qrText: string,
  history: ReceiptData[] = [],
  existingCategories: string[] = []
): Promise<ExtractedReceiptData> {
  const today = new Date().toISOString().split('T')[0];
  const categoriesList = existingCategories.length > 0 ? existingCategories.join(', ') : 'Groceries, Dining, Transport, Entertainment, Healthcare, Utilities, Shopping, Others';

  const isUrl = qrText.startsWith('http://') || qrText.startsWith('https://');
  
  const textPart = { text: `You are an expert data parser. Extract receipt details from this QR code content: "${qrText}". 
  ${isUrl ? 'The content is a URL. Use the provided URL context to fetch and extract the receipt details from the page.' : 'The content might be raw receipt text, JSON, a URL with parameters, or a structured string.'}
  
  If the content is raw receipt text (like a digital receipt dump), parse it carefully to identify the merchant, date, items, and total.
  
  Extract all data into the provided JSON schema.
  - merchantName: Name of the store/merchant.
  - totalAmount: The total cost (number).
  - transactionDate: YYYY-MM-DD format. If missing, use ${today}.
  - currency: 3-letter ISO code (e.g., USD, INR). Default to USD if unknown.
  - category: Categorize into one of these if they fit: ${categoriesList}. If none fit, create a new single-word category.
  - items: An array of objects with name, quantity, and price. If not listed, create one item summarizing the total.
  
  Always return valid JSON matching the schema exactly.` };

  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [textPart] },
    config: { 
        responseMimeType: 'application/json', 
        responseSchema: receiptSchema,
        temperature: 0.1,
        tools: isUrl ? [{ urlContext: {} }] : undefined
    },
  });
  
  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response.");
  const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const data = JSON.parse(cleanJson);
  data.merchantName = normalizeMerchantName(data.merchantName, history);
  data.items = data.items || [];
  data.confidence = (data.totalAmount > 0 && data.merchantName !== 'Unknown') ? 1.0 : 0.5;
  data.isVerified = false;
  return data as ExtractedReceiptData;
}

export function getSystemInstruction(receipts: ReceiptData[], userSettings: UserSettings, analysisMonth?: string) {
    const symbol = getCurrencySymbol(userSettings.currency);
    const anomalies = detectAnomalies(receipts);
    
    // Group receipts by month for trend analysis
    const monthlySpending: Record<string, number> = {};
    receipts.forEach(r => {
        const month = r.transactionDate.substring(0, 7); // YYYY-MM
        monthlySpending[month] = (monthlySpending[month] || 0) + (r.convertedAmount || r.totalAmount);
    });

    const currentMonth = new Date().toISOString().substring(0, 7);
    const targetMonth = analysisMonth || currentMonth;
    
    const relevantReceipts = receipts.filter(r => r.transactionDate.startsWith(targetMonth));
    const totalSpent = relevantReceipts.reduce((sum, r) => sum + (r.convertedAmount || r.totalAmount), 0);
    const remainingBudget = Math.max(0, userSettings.budget - totalSpent);
    
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const remainingDays = Math.max(1, daysInMonth - new Date().getDate());
    const dailyLimit = remainingBudget / remainingDays;

    const memory = relevantReceipts.slice(-20).map(r => 
        `- [${r.transactionDate}] ${r.merchantName} (${r.category}): ${symbol}${(r.convertedAmount || r.totalAmount).toFixed(2)} [REF: ${r.id}]`
    ).join('\n');

    const historicalContext = Object.entries(monthlySpending)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 6)
        .map(([m, amt]) => `${m}: ${symbol}${amt.toFixed(2)}`)
        .join(', ');

    const fixedBillsContext = (userSettings.fixedBills || []).map(b => `- ${b.name}: ${symbol}${b.amount}`).join('\n');
    const totalFixed = (userSettings.fixedBills || []).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

    return `You are AI Buddy, a high-performance financial intelligence system.
${analysisMonth ? `You are currently analyzing the spending for ${analysisMonth}.` : 'You are currently analyzing the current month.'}

YOUR KNOWLEDGE (REAL-TIME DATA):
User Profile: ${userSettings.userName}
Monthly Income: ${symbol}${userSettings.income}
Monthly Variable Budget: ${symbol}${userSettings.budget}
Total Spent so far in ${targetMonth}: ${symbol}${totalSpent.toFixed(2)}
Remaining Budget: ${symbol}${remainingBudget.toFixed(2)}
${targetMonth === currentMonth ? `Days remaining in month: ${remainingDays}
Safe Daily Spending Limit: ${symbol}${dailyLimit.toFixed(2)}` : ''}

Monthly Savings Goal: ${symbol}${userSettings.savings || 0}
Monthly Buffer: ${userSettings.isBufferEnabled ? `${symbol}${userSettings.bufferAmount}` : 'None'}

Fixed Bills/Commitments (Total: ${symbol}${totalFixed}):
${fixedBillsContext || "No fixed bills recorded."}

Historical Monthly Totals: ${historicalContext || "No history yet."}

Transactions for ${targetMonth}:
${memory || "No transactions recorded for this period."}

${anomalies ? `ANOMALY DETECTION:
Recent spending is ${anomalies.deviation}% higher than your historical average. 
Main driver: ${anomalies.dominantCategory}.` : ''}

FINANCIAL GUIDANCE:
- Use the "Safe Daily Spending Limit" to give concrete advice.
- Compare current spending to previous months if relevant.
- Be supportive but direct about overspending.
- Cite specific transactions when giving advice.
- Use the fixed bills and savings goal to provide a holistic view of their finances.
- **CRITICAL**: When citing transactions in the "Evidence Used" section, you MUST include the reference ID in the format [REF: id].

RESPONSE FORMAT:
Insight Summary: [A simple overview of status]
Evidence Used: [Bullet points of specific dates/merchants with [REF: id]]
Behavior Pattern: [Analysis of spending habits]
Actionable Suggestions: [Steps to save or plan]
Confidence Level: [Low/Medium/High]`;
}

export async function* getFinanceBuddyStream(input: string, receipts: ReceiptData[], userSettings: UserSettings) {
    const ai = getAI();
    const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: { systemInstruction: getSystemInstruction(receipts, userSettings) }
    });
    const result = await chat.sendMessageStream({ message: input });
    for await (const chunk of result) {
        if (chunk.text) yield chunk.text;
    }
}

export async function getSpendingInsight(receipts: ReceiptData[], userSettings: UserSettings, analysisMonth?: string): Promise<string> {
    const ai = getAI();
    const prompt = analysisMonth 
        ? `Provide a high-impact financial insight for the month of ${analysisMonth}. Compare it to history if possible. Max 25 words.`
        : `Provide a single high-impact financial insight based on these receipts. Max 20 words.`;
        
    const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: prompt,
        config: { systemInstruction: getSystemInstruction(receipts, userSettings, analysisMonth) }
    });
    return response.text || '';
}

export async function textToSpeech(text: string): Promise<string | null> {
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text.substring(0, 500) }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
            },
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch { return null; }
}
