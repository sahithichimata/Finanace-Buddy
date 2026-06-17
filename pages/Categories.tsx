import React, { useState } from 'react';
import { PlusIcon, TrashIcon, BoltIcon, TagIcon } from '../components/Icons';
import type { Category } from '../types';

interface CategoriesProps {
    categories: Category[];
    setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
}

const Categories: React.FC<CategoriesProps> = ({ categories, setCategories }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [newCatIcon, setNewCatIcon] = useState('📦');

    const handleAddCategory = (e: React.FormEvent) => {
        e.preventDefault();
        if (newCatName.trim()) {
            const newCategory = { 
                id: Math.random().toString(36).substr(2, 9), 
                name: newCatName.trim(), 
                icon: newCatIcon 
            };
            setCategories([...categories, newCategory]);
            setNewCatName('');
            setIsAdding(false);
        }
    };

    const handleDeleteCategory = (id: string) => {
        setCategories(categories.filter(c => c.id !== id));
    };

    return (
        <div className="w-full min-h-screen p-4 sm:p-6 lg:p-12 animate-in fade-in duration-500 text-gray-100">
            <header className="max-w-6xl mx-auto mb-12 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic flex items-center gap-3">
                        <TagIcon className="w-8 h-8 text-primary" />
                        Categories
                    </h1>
                    <p className="text-gray-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Manage your spending taxonomy</p>
                </div>
                <button 
                    onClick={() => setIsAdding(!isAdding)} 
                    className="px-8 py-3 bg-primary text-white rounded-full text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-neon-primary flex items-center gap-2"
                >
                    {isAdding ? 'Close' : <><PlusIcon width={16} height={16} /> Add Category</>}
                </button>
            </header>

            <div className="max-w-6xl mx-auto">
                {isAdding && (
                    <form onSubmit={handleAddCategory} className="mb-12 p-8 bg-dark-card border border-primary/30 rounded-[40px] animate-in slide-in-from-top-4 duration-500 flex flex-col sm:flex-row items-end gap-6 shadow-2xl">
                        <div className="flex-1 space-y-2 w-full">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Category Name</label>
                            <input 
                                autoFocus
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                                placeholder="e.g. Health & Wellness"
                                className="w-full bg-gray-900 border border-gray-800 text-white rounded-2xl p-4 focus:border-primary outline-none transition-all font-bold"
                            />
                        </div>
                        <div className="space-y-2 w-full sm:w-32">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Icon/Emoji</label>
                            <input 
                                value={newCatIcon}
                                onChange={(e) => setNewCatIcon(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-800 text-white rounded-2xl p-4 focus:border-primary outline-none transition-all text-center text-xl"
                            />
                        </div>
                        <button type="submit" className="px-8 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-primary hover:text-white transition-all w-full sm:w-auto">
                            Confirm
                        </button>
                    </form>
                )}

                <div className="bg-dark-card border border-gray-800 rounded-[48px] overflow-hidden shadow-2xl">
                    <div className="p-8 border-b border-gray-800 flex items-center justify-between bg-gray-900/30">
                        <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">Active Taxonomy</h2>
                        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
                            {categories.length} Total
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-800">
                        {categories.map(cat => (
                            <div key={cat.id} className="bg-dark-card p-8 flex items-center justify-between group hover:bg-gray-900/50 transition-all">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-gray-900 rounded-3xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform duration-500 border border-gray-800">
                                        {cat.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white tracking-tight uppercase italic">{cat.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Active</span>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleDeleteCategory(cat.id)}
                                    className="p-3 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <TrashIcon width={20} height={20} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-12 p-8 bg-primary/5 border border-primary/20 rounded-[40px] flex items-center gap-6">
                    <div className="p-4 bg-primary/10 rounded-3xl text-primary">
                        <BoltIcon width={32} height={32} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-tight">Dynamic Taxonomy Alignment</h3>
                        <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                            The Neural OCR engine automatically identifies new spending categories from your receipts. If a detected category doesn't exist, it is added here automatically to maintain a consistent financial overview.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Categories;
