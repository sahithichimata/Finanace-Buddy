
import { ReceiptData } from '../types';

/**
 * A map of common OCR errors and their corrected merchant names.
 */
const COMMON_MERCHANT_CORRECTIONS: Record<string, string> = {
  'starbuks': 'Starbucks',
  'starbuck': 'Starbucks',
  'wlmart': 'Walmart',
  'wallmart': 'Walmart',
  'wal-mart': 'Walmart',
  'mcdonalds': "McDonald's",
  'mcdonald': "McDonald's",
  'mcdonald s': "McDonald's",
  'subway': 'Subway',
  'amazon.com': 'Amazon',
  'amzn': 'Amazon',
  'target corp': 'Target',
  'targt': 'Target',
  'uber trip': 'Uber',
  'uber eats': 'Uber Eats',
  'zomato': 'Zomato',
  'swiggy': 'Swiggy',
  'netflix.com': 'Netflix',
  'apple.com/bill': 'Apple',
  'itunes.com': 'Apple',
  'google *': 'Google',
  'shell oil': 'Shell',
  'bp gas': 'BP',
  'costco whse': 'Costco',
  'wholefds': 'Whole Foods',
  'whole foods market': 'Whole Foods',
};

/**
 * Normalizes a merchant name by:
 * 1. Trimming whitespace
 * 2. Checking against a common corrections dictionary
 * 3. Comparing with user's historical transactions for consistency
 */
export function normalizeMerchantName(
  rawName: string,
  history: ReceiptData[] = []
): string {
  if (!rawName) return 'Unknown Merchant';

  const normalized = rawName.trim();
  const lowerName = normalized.toLowerCase();

  // 1. Check exact match in common corrections
  if (COMMON_MERCHANT_CORRECTIONS[lowerName]) {
    return COMMON_MERCHANT_CORRECTIONS[lowerName];
  }

  // 2. Check if any key in common corrections is a substring
  for (const [typo, correction] of Object.entries(COMMON_MERCHANT_CORRECTIONS)) {
    if (lowerName.includes(typo)) {
      return correction;
    }
  }

  // 3. Check historical transactions for a similar name
  // If we find a very similar name in history, use the most frequent one
  if (history.length > 0) {
    const merchantCounts: Record<string, number> = {};
    history.forEach(r => {
      const name = r.merchantName;
      merchantCounts[name] = (merchantCounts[name] || 0) + 1;
    });

    const historicalNames = Object.keys(merchantCounts);
    
    // Simple similarity check: if the raw name is a substring or vice versa
    for (const histName of historicalNames) {
      const lowerHist = histName.toLowerCase();
      if (lowerName === lowerHist) return histName;
      
      // If one is a significant substring of the other (at least 4 chars)
      if (lowerName.length >= 4 && lowerHist.length >= 4) {
        if (lowerName.includes(lowerHist) || lowerHist.includes(lowerName)) {
          return histName;
        }
      }
    }
  }

  // 4. Fallback to title case if no match found
  return normalized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
