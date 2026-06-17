
export async function getExchangeRate(from: string, to: string): Promise<{ rate: number; timestamp: string }> {
  if (from === to) return { rate: 1, timestamp: new Date().toISOString() };
  
  try {
    // Using a free API that doesn't require a key for basic usage
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`);
    if (!response.ok) throw new Error('Failed to fetch exchange rates');
    
    const data = await response.json();
    const rate = data.rates[to.toUpperCase()];
    
    if (!rate) {
      console.warn(`Rate for ${to} not found in response for ${from}`);
      return { rate: 1, timestamp: new Date().toISOString() };
    }
    
    return { 
      rate, 
      timestamp: new Date().toISOString() 
    };
  } catch (error) {
    console.error('Currency conversion error:', error);
    // Fallback to 1:1 if API fails
    return { rate: 1, timestamp: new Date().toISOString() };
  }
}

export const CURRENCY_OPTIONS = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
];
