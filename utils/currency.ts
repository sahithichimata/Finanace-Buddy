
export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

export const supportedCurrencies: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
];

export const getCurrencySymbol = (currencyCode: string): string => {
    const currency = supportedCurrencies.find(c => c.code === currencyCode);
    return currency ? currency.symbol : currencyCode;
}

const localeMap: Record<string, string> = {
    'INR': 'en-IN',
    'USD': 'en-US',
    'EUR': 'de-DE',
    'GBP': 'en-GB',
    'JPY': 'ja-JP',
    'AUD': 'en-AU',
    'CAD': 'en-CA',
    'SGD': 'en-SG',
    'AED': 'ar-AE',
    'CNY': 'zh-CN',
};

/**
 * Formats a number as a currency string.
 * Supports privacy mode which masks the values.
 */
export const formatCurrency = (amount: number, currencyCode: string, isPrivacyMode: boolean = false): string => {
    if (isPrivacyMode) {
        return `${getCurrencySymbol(currencyCode)} ••••`;
    }

    const locale = localeMap[currencyCode] || 'en-US';

    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    } catch (error) {
        console.error(`Error formatting currency ${currencyCode}:`, error);
        const symbol = getCurrencySymbol(currencyCode);
        return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
};
