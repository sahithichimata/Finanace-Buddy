
import React, { useState, useMemo } from 'react';
import type { ReceiptData, UserSettings, Category } from '../types';
import { formatCurrency } from '../utils/currency';
import { BoltIcon, XMarkIcon, TrashIcon, PencilIcon } from '../components/Icons';

interface ReceiptsProps {
  receipts: ReceiptData[];
  userSettings: UserSettings;
  categories: Category[];
  onUpdateCategory: (id: string, category: string) => void;
  onDeleteReceipt: (id: string) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
}

const formatDate = (dateString: string) => {
    try {
        const date = new Date(dateString);
        date.setDate(date.getDate() + 1);
        return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
    } catch {
        return dateString;
    }
}

const Receipts: React.FC<ReceiptsProps> = ({ receipts, userSettings, categories, onUpdateCategory, onDeleteReceipt, selectedMonth, setSelectedMonth }) => {
    const { currency, isPrivacyMode } = userSettings;
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showLearningToast, setShowLearningToast] = useState(false);

    const now = new Date();

    const deletingReceipt = useMemo(() => 
        receipts.find(r => r.id === deletingId),
    [receipts, deletingId]);

    const filteredReceipts = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        const monthly = receipts.filter(r => r.transactionDate.startsWith(selectedMonth));
        const sorted = [...monthly].sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
        
        if (!term) return sorted;

        return sorted.filter(r => 
            r.merchantName.toLowerCase().includes(term) || 
            r.category.toLowerCase().includes(term) ||
            (r.notes && r.notes.toLowerCase().includes(term))
        );
    }, [receipts, searchTerm, selectedMonth]);

    const handleCategoryCorrection = (id: string, newCat: string) => {
        onUpdateCategory(id, newCat);
        setEditingId(null);
        setShowLearningToast(true);
        setTimeout(() => setShowLearningToast(false), 2500);
    };

    return (
        <div className="w-full p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500 relative">
            {showLearningToast && (
                <div className="fixed top-24 right-8 z-[200] bg-accent text-white px-6 py-4 rounded-[20px] shadow-neon-accent flex items-center gap-3 animate-in slide-in-from-right-8 duration-500">
                    <BoltIcon className="w-5 h-5 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Model Adaptive Training...</span>
                </div>
            )}

            <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
                    <div>
                        <h1 className="text-4xl font-bold text-white tracking-tight">Archives</h1>
                        <p className="text-gray-400 mt-1">Transaction history and neural logs.</p>
                    </div>
                    {/* Month Selector */}
                    <div className="bg-white/5 border border-white/10 backdrop-blur-xl px-6 py-3 rounded-2xl flex items-center gap-4 shadow-2xl">
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Period:</span>
                        <input 
                            type="month" 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            max={now.toISOString().substring(0, 7)}
                            className="bg-transparent text-white font-black uppercase text-xs outline-none cursor-pointer [color-scheme:dark]"
                        />
                    </div>
                </div>
                <div className="w-full sm:w-72 relative">
                    <input 
                        type="text" 
                        placeholder="Search merchant, category..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-dark-card border border-gray-700 text-white rounded-xl py-3 pl-10 pr-4 focus:border-primary outline-none transition-all font-medium text-sm placeholder:text-gray-600"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                    </div>
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white">
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </header>

            <div className="bg-dark-card border border-gray-700 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="border-b border-gray-700 text-xs uppercase tracking-wider text-gray-500">
                            <tr>
                                <th className="p-4">Vendor</th>
                                <th className="p-4">Date</th>
                                <th className="p-4">Amount</th>
                                <th className="p-4">Category</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {filteredReceipts.length > 0 ? filteredReceipts.map(receipt => (
                                <tr key={receipt.id} className="group hover:bg-gray-800/50 transition-colors">
                                    <td className="p-4">
                                        <p className="font-semibold text-white group-hover:text-primary transition-colors">{receipt.merchantName}</p>
                                    </td>
                                    <td className="p-4 text-gray-400 text-sm font-medium">{formatDate(receipt.transactionDate)}</td>
                                    <td className="p-4 font-mono font-bold text-accent">
                                        <div className="flex flex-col">
                                            <span>{formatCurrency(receipt.convertedAmount || receipt.totalAmount, currency, isPrivacyMode)}</span>
                                            {receipt.exchangeRate && receipt.exchangeRate !== 1 && (
                                                <span className="text-[9px] text-gray-500 font-medium">
                                                    Orig: {formatCurrency(receipt.totalAmount, receipt.currency || currency, isPrivacyMode)}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {editingId === receipt.id ? (
                                            <select 
                                                autoFocus
                                                onBlur={() => setEditingId(null)}
                                                onChange={(e) => {
                                                    if (e.target.value === 'ADD_NEW') {
                                                        const name = prompt("Enter new category name:");
                                                        if (name) {
                                                            handleCategoryCorrection(receipt.id, name);
                                                        }
                                                        setEditingId(null);
                                                    } else {
                                                        handleCategoryCorrection(receipt.id, e.target.value);
                                                    }
                                                }}
                                                className="bg-gray-900 text-primary border border-primary/50 text-[10px] font-black uppercase rounded-lg px-2 py-1 outline-none"
                                                defaultValue={receipt.category}
                                            >
                                                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                                {!categories.some(c => c.name === receipt.category) && (
                                                    <option value={receipt.category}>{receipt.category}</option>
                                                )}
                                                <option value="ADD_NEW">+ Add New...</option>
                                            </select>
                                        ) : (
                                            <span 
                                                onClick={() => setEditingId(receipt.id)}
                                                className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full cursor-pointer transition-all border ${receipt.isVerified ? 'bg-accent/10 text-accent border-accent/20' : 'bg-primary/10 text-primary border-primary/20 hover:border-primary/50'}`}
                                            >
                                                {receipt.category}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => setEditingId(receipt.id)} 
                                                className="text-gray-500 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700/50"
                                                title="Edit Category"
                                            >
                                                <PencilIcon className="w-5 h-5" />
                                            </button>
                                            <button 
                                                onClick={() => setDeletingId(receipt.id)} 
                                                className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-500/10"
                                                title="Delete Receipt"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="text-center py-20 text-gray-600 italic text-sm">No transactions matched your search.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deletingId && (
                <div 
                    className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300"
                    onClick={() => setDeletingId(null)}
                >
                    <div 
                        className="w-full max-w-md bg-dark-card border border-gray-800 rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-300 relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setDeletingId(null)}
                            className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>

                        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mb-6 mx-auto">
                            <TrashIcon className="w-8 h-8" />
                        </div>
                        
                        <h3 className="text-2xl font-black text-white text-center tracking-tighter uppercase italic mb-2">Delete Receipt?</h3>
                        <p className="text-gray-400 text-center text-sm mb-8">
                            This action is permanent and cannot be undone. The record for <span className="text-white font-bold">"{deletingReceipt?.merchantName}"</span> will be purged from the vault.
                        </p>
                        
                        <div className="flex gap-4">
                            <button 
                                onClick={() => setDeletingId(null)}
                                className="flex-1 py-4 text-gray-500 font-black uppercase tracking-widest text-[10px] border border-gray-800 rounded-2xl hover:bg-gray-800 transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => {
                                    onDeleteReceipt(deletingId);
                                    setDeletingId(null);
                                }}
                                className="flex-1 py-4 bg-red-500 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Receipts;
