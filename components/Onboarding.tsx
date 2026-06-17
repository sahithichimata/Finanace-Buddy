import React, { useState, useMemo } from 'react';
import { UserSettings, FixedBill } from '../types';
import { supportedCurrencies } from '../utils/currency';
import { BoltIcon, PlusIcon, TrashIcon } from './Icons';
import { hashPin } from '../utils/security';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface OnboardingProps {
    onComplete: (settings: UserSettings) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const [pinPhase, setPinPhase] = useState<'entry' | 'confirm'>('entry');
    const [settings, setSettings] = useState<UserSettings>({
        userName: '',
        budget: 5000,
        currency: 'INR',
        income: 25000,
        savings: 5000,
        fixedBills: [
            { id: '1', name: 'Rent', amount: 8000 },
            { id: '2', name: 'Utilities', amount: 2000 }
        ],
        isPrivacyMode: false,
        isOnboarded: true,
        autoLockMinutes: 10,
        savingsGoal: 0,
        isBufferEnabled: false,
        bufferAmount: 0
    });
    
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [pinError, setPinError] = useState<string | null>(null);

    const handleNext = () => {
        if (step === 3) {
            setStep(4);
            setPinPhase('entry');
        } else if (step === 4) {
            if (pinPhase === 'entry') {
                if (pin.length !== 4) {
                    setPinError("PIN must be 4 digits.");
                    return;
                }
                setPinPhase('confirm');
            } else {
                if (pin !== confirmPin) {
                    setPinError("Pins don't match. Try again.");
                    setPin(''); setConfirmPin(''); setPinPhase('entry');
                    return;
                }
                onComplete({
                    ...settings,
                    pinCode: hashPin(pin)
                });
            }
        } else {
            setStep(prev => prev + 1);
        }
    };

    const totalFixed = useMemo(() => settings.fixedBills.reduce((acc, bill) => acc + bill.amount, 0), [settings.fixedBills]);
    const totalAllocated = settings.budget + totalFixed + settings.savings + (settings.isBufferEnabled ? settings.bufferAmount : 0);
    const isOverBudget = totalAllocated > settings.income;

    const chartData = useMemo(() => [
        { name: 'Income', value: settings.income },
        { name: 'Fixed', value: totalFixed },
        { name: 'Spending', value: settings.budget },
        { name: 'Savings', value: settings.savings },
        { name: 'Buffer', value: settings.isBufferEnabled ? settings.bufferAmount : 0 },
        { name: 'Remaining', value: Math.max(0, settings.income - totalAllocated) }
    ], [settings.income, totalFixed, settings.budget, settings.savings, settings.isBufferEnabled, settings.bufferAmount, totalAllocated]);

    const addFixedBill = () => {
        const newBill: FixedBill = {
            id: Math.random().toString(36).substr(2, 9),
            name: '',
            amount: 0
        };
        setSettings({ ...settings, fixedBills: [...settings.fixedBills, newBill] });
    };

    const updateFixedBill = (id: string, updates: Partial<FixedBill>) => {
        setSettings({
            ...settings,
            fixedBills: settings.fixedBills.map(bill => bill.id === id ? { ...bill, ...updates } : bill)
        });
    };

    const removeFixedBill = (id: string) => {
        setSettings({
            ...settings,
            fixedBills: settings.fixedBills.filter(bill => bill.id !== id)
        });
    };

    return (
        <div className="fixed inset-0 z-[150] bg-dark-bg flex items-center justify-center p-6 font-sans">
            <div className="w-full max-w-xl bg-dark-card border border-gray-800 rounded-[48px] p-10 sm:p-16 shadow-2xl relative overflow-hidden">
                <div className="relative space-y-12">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="w-16 h-16 bg-gradient-to-tr from-primary to-accent rounded-2xl flex items-center justify-center shadow-lg">
                            <BoltIcon className="w-10 h-10 text-white" />
                        </div>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${step === i ? 'w-8 bg-primary' : 'w-2 bg-gray-800'}`} />
                            ))}
                        </div>
                    </div>

                    {step === 1 && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 text-center">
                            <div>
                                <h2 className="text-4xl font-bold text-white tracking-tight">Your Name</h2>
                                <p className="text-gray-500 mt-2">What should we call you?</p>
                            </div>
                            <input autoFocus type="text" value={settings.userName} onChange={e => setSettings({...settings, userName: e.target.value})} placeholder="Enter name..." className="w-full bg-gray-900 border-2 border-gray-800 text-white rounded-2xl p-6 text-xl outline-none" />
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 text-center">
                            <div>
                                <h2 className="text-4xl font-bold text-white tracking-tight">Currency</h2>
                                <p className="text-gray-500 mt-2">Pick your local currency.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {supportedCurrencies.map(cur => (
                                    <button 
                                        key={cur.code}
                                        onClick={() => setSettings({...settings, currency: cur.code})}
                                        className={`p-5 rounded-2xl border-2 flex items-center justify-between transition-all ${settings.currency === cur.code ? 'border-primary bg-primary/5' : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'}`}
                                    >
                                        <div className="text-left">
                                            <p className="text-lg font-bold text-white">{cur.name}</p>
                                        </div>
                                        <span className="text-xl font-mono text-primary">{cur.symbol}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            <div className="text-center">
                                <h2 className="text-4xl font-bold text-white tracking-tight">Your Plan</h2>
                                <p className="text-gray-500 mt-2">Help us understand your money.</p>
                            </div>

                            <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-6">
                                <div className="h-48 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                            <XAxis dataKey="name" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis hide />
                                            <Tooltip 
                                                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px' }}
                                                itemStyle={{ color: '#6C63FF' }}
                                            />
                                            <Line type="monotone" dataKey="value" stroke="#6C63FF" strokeWidth={3} dot={{ fill: '#6C63FF', r: 4 }} activeDot={{ r: 6 }} />
                                            <ReferenceLine y={settings.income} stroke="#10B981" strokeDasharray="3 3" label={{ position: 'top', value: 'Income', fill: '#10B981', fontSize: 10 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="mt-4 flex justify-between items-center">
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${isOverBudget ? 'text-red-500' : 'text-emerald-500'}`}>
                                        {isOverBudget ? 'Allocation exceeds income!' : 'Allocation is healthy'}
                                    </p>
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                        Total: {totalAllocated} / {settings.income}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">1. Monthly Income</label>
                                    <input 
                                        type="text" 
                                        inputMode="numeric"
                                        value={settings.income === 0 ? '' : settings.income} 
                                        onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
                                            setSettings({...settings, income: val === '' ? 0 : Number(val)});
                                        }} 
                                        className="w-full bg-gray-900 border-2 border-gray-800 text-white rounded-2xl p-4 text-lg font-mono outline-none focus:border-primary" 
                                    />
                                    <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest ml-1">Total to allocate: {settings.income}</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">2. Fixed Budget (Bills)</label>
                                        <button onClick={addFixedBill} className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                                            <PlusIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {settings.fixedBills.map(bill => (
                                            <div key={bill.id} className="flex gap-3 animate-in slide-in-from-left-2 duration-300">
                                                <input 
                                                    type="text"
                                                    placeholder="Bill Name"
                                                    value={bill.name}
                                                    onChange={e => updateFixedBill(bill.id, { name: e.target.value })}
                                                    className="flex-grow bg-gray-900 border border-gray-800 text-white rounded-xl p-3 text-sm outline-none focus:border-primary"
                                                />
                                                <input 
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="Amount"
                                                    value={bill.amount === 0 ? '' : bill.amount}
                                                    onChange={e => {
                                                        const val = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
                                                        updateFixedBill(bill.id, { amount: val === '' ? 0 : Number(val) });
                                                    }}
                                                    className="w-24 bg-gray-900 border border-gray-800 text-white rounded-xl p-3 text-sm font-mono outline-none focus:border-primary"
                                                />
                                                <button onClick={() => removeFixedBill(bill.id)} className="p-3 text-gray-600 hover:text-red-500 transition-colors">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        <div className="p-4 bg-gray-900/30 border border-dashed border-gray-800 rounded-2xl flex justify-between items-center">
                                            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Total Fixed: {totalFixed}</p>
                                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Left: {settings.income - totalFixed}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">3. Monthly Spending Budget</label>
                                    <input 
                                        type="text" 
                                        inputMode="numeric"
                                        value={settings.budget === 0 ? '' : settings.budget} 
                                        onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
                                            setSettings({...settings, budget: val === '' ? 0 : Number(val)});
                                        }} 
                                        className="w-full bg-gray-900 border-2 border-gray-800 text-white rounded-2xl p-4 text-lg font-mono outline-none focus:border-primary" 
                                    />
                                    <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest ml-1">Left after spending: {settings.income - totalFixed - settings.budget}</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">4. Monthly Savings</label>
                                    <input 
                                        type="text" 
                                        inputMode="numeric"
                                        value={settings.savings === 0 ? '' : settings.savings} 
                                        onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
                                            setSettings({...settings, savings: val === '' ? 0 : Number(val)});
                                        }} 
                                        className="w-full bg-gray-900 border-2 border-gray-800 text-white rounded-2xl p-4 text-lg font-mono outline-none focus:border-primary" 
                                    />
                                    <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest ml-1">Final Remaining: {settings.income - totalAllocated}</p>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-gray-800">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold text-white">Enable Buffer Money</h3>
                                            <p className="text-[10px] text-gray-500">Keep some extra cash for unexpected expenses.</p>
                                        </div>
                                        <button 
                                            onClick={() => setSettings({...settings, isBufferEnabled: !settings.isBufferEnabled})}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${settings.isBufferEnabled ? 'bg-primary' : 'bg-gray-800'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.isBufferEnabled ? 'left-7' : 'left-1'}`} />
                                        </button>
                                    </div>

                                    {settings.isBufferEnabled && (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="flex gap-3">
                                                <input 
                                                    type="text" 
                                                    inputMode="numeric"
                                                    placeholder="Buffer Amount"
                                                    value={settings.bufferAmount === 0 ? '' : settings.bufferAmount} 
                                                    onChange={e => {
                                                        const val = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
                                                        setSettings({...settings, bufferAmount: val === '' ? 0 : Number(val)});
                                                    }} 
                                                    className="flex-grow bg-gray-900 border-2 border-gray-800 text-white rounded-2xl p-4 text-lg font-mono outline-none focus:border-primary" 
                                                />
                                                <button 
                                                    onClick={() => {
                                                        const remaining = settings.income - (settings.budget + totalFixed + settings.savings);
                                                        setSettings({...settings, bufferAmount: Math.max(0, remaining)});
                                                    }}
                                                    className="px-4 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-primary/20 transition-colors"
                                                >
                                                    Use Remaining
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 text-center">
                            <div>
                                <h2 className="text-4xl font-bold text-white tracking-tight">App Security</h2>
                                <p className="text-gray-500 mt-2">
                                    {pinPhase === 'entry' ? 'Set a 4-digit PIN for privacy.' : 'Verify your PIN.'}
                                </p>
                            </div>
                            <input type="password" maxLength={4} autoFocus key={pinPhase} value={pinPhase === 'entry' ? pin : confirmPin} onChange={e => { const val = e.target.value.replace(/\D/g, ''); pinPhase === 'entry' ? setPin(val) : setConfirmPin(val); setPinError(null); }} placeholder="••••" className="w-full bg-gray-900 border-2 border-gray-800 text-white text-center rounded-2xl p-4 text-4xl font-mono tracking-[1rem] outline-none" />
                            {pinError && <p className="text-red-500 text-[10px] font-black uppercase">{pinError}</p>}
                        </div>
                    )}

                    <div className="flex gap-4">
                        <button 
                            onClick={handleNext}
                            disabled={(step === 1 && !settings.userName.trim()) || (step === 4 && pinPhase === 'entry' && pin.length !== 4) || (step === 4 && pinPhase === 'confirm' && confirmPin.length !== 4)}
                            className={`flex-1 bg-primary text-white py-6 rounded-[24px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50`}
                        >
                            {step === 4 ? 'Finish' : 'Next'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};