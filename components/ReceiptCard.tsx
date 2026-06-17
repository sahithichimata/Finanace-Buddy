
import React from 'react';
import type { ExtractedReceiptData } from '../types';
import { formatCurrency } from '../utils/currency';

interface ReceiptCardProps {
  data: ExtractedReceiptData;
  imageUrl: string;
  currency?: string;
  isPrivacyMode?: boolean;
}

const formatDate = (dateString: string) => {
    try {
        const date = new Date(dateString);
        date.setDate(date.getDate() + 1);
        return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(date);
    } catch (e) {
        return dateString;
    }
}

export const ReceiptCard: React.FC<ReceiptCardProps> = ({ 
    data, 
    imageUrl, 
    currency = 'INR', 
    isPrivacyMode = false 
}) => {
  return (
    <div className="group perspective-1000">
        <div className="bg-dark-card border border-gray-700 rounded-2xl p-6 shadow-lg transition-transform duration-500 transform-style-3d group-hover:rotate-y-3 group-hover:scale-105">
            <div className="flex flex-col sm:flex-row gap-6 mb-6">
                <div className="w-full sm:w-1/3 relative group/img overflow-hidden rounded-lg border border-gray-600">
                    <img src={imageUrl} alt="Receipt preview" className="w-full h-auto object-cover transition-transform duration-700 group-hover/img:scale-110"/>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity" />
                </div>
                <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent break-words">{data.merchantName}</h3>
                    <p className="text-gray-400 mt-1">{formatDate(data.transactionDate)}</p>
                    <div className="mt-4 bg-gradient-to-r from-primary to-accent p-4 rounded-xl shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-20">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium text-white/80">Total Amount</p>
                        <p className="text-4xl font-bold font-mono text-white">
                            {formatCurrency(data.totalAmount, currency, isPrivacyMode)}
                        </p>
                    </div>
                </div>
            </div>
            
            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3 border-b border-gray-700 pb-2 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-3.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
                Detailed Breakdown
            </h4>
            <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {data.items && data.items.length > 0 ? (
                    <ul className="space-y-2">
                    {data.items.map((item, index) => (
                        <li key={index} className="flex justify-between items-center bg-gray-800/30 p-3 rounded-lg border border-gray-700/50 text-sm">
                            <span className="flex-1 text-gray-300 font-medium">{item.name}</span>
                            <span className="text-gray-500 mx-4">×{item.quantity}</span>
                            <span className="text-white font-mono font-semibold">
                                {formatCurrency(item.price, currency, isPrivacyMode)}
                            </span>
                        </li>
                    ))}
                    </ul>
                ) : (
                    <p className="text-gray-500 text-center py-4 italic">No granular items identified</p>
                )}
            </div>
        </div>
    </div>
  );
};
