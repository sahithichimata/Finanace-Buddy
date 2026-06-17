import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { UserSettings, FixedBill } from '../types';
import { supportedCurrencies, formatCurrency } from '../utils/currency';
import { hashPin } from '../utils/security';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { PlusIcon, TrashIcon } from '../components/Icons';

interface ProfileProps {
    userSettings: UserSettings;
    onSave: (newSettings: UserSettings) => void;
    onWipeData: () => void;
}

type CriticalAction = 'save_settings' | 'disable_security';

const Profile: React.FC<ProfileProps> = ({ userSettings, onSave, onWipeData }) => {
    const [currentSettings, setCurrentSettings] = useState<UserSettings>(userSettings);
    
    // Security States
    const [pinFlow, setPinFlow] = useState<'idle' | 'entry' | 'confirm'>('idle');
    const [tempPin, setTempPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [pinError, setPinError] = useState<string | null>(null);

    // Re-authentication State
    const [pendingAction, setPendingAction] = useState<CriticalAction | null>(null);
    const [authPinInput, setAuthPinInput] = useState('');
    const [authError, setAuthError] = useState(false);

    // Purge States
    const [wipeStage, setWipeStage] = useState<'idle' | 'verify' | 'final'>('idle');
    const [verifyInput, setVerifyInput] = useState('');
    const [verifyError, setVerifyError] = useState(false);
    const [isPurging, setIsPurging] = useState(false);
    const [purgeProgress, setPurgeProgress] = useState(0);
    const [purgeStatus, setPurgeStatus] = useState('Starting reset...');
    const [saveStatus, setSaveStatus] = useState(false);

    const isSecurityEnabled = !!userSettings.pinCode;

    const totalFixed = useMemo(() => currentSettings.fixedBills.reduce((acc, bill) => acc + bill.amount, 0), [currentSettings.fixedBills]);
    const totalAllocated = currentSettings.budget + totalFixed + currentSettings.savings + (currentSettings.isBufferEnabled ? currentSettings.bufferAmount : 0);
    const isOverBudget = totalAllocated > currentSettings.income;

    const chartData = useMemo(() => [
        { name: 'Income', value: currentSettings.income },
        { name: 'Fixed', value: totalFixed },
        { name: 'Spending', value: currentSettings.budget },
        { name: 'Savings', value: currentSettings.savings },
        { name: 'Buffer', value: currentSettings.isBufferEnabled ? currentSettings.bufferAmount : 0 },
        { name: 'Remaining', value: Math.max(0, currentSettings.income - totalAllocated) }
    ], [currentSettings.income, totalFixed, currentSettings.budget, currentSettings.savings, currentSettings.isBufferEnabled, currentSettings.bufferAmount, totalAllocated]);

    const addFixedBill = () => {
        const newBill: FixedBill = {
            id: Math.random().toString(36).substr(2, 9),
            name: '',
            amount: 0
        };
        setCurrentSettings({ ...currentSettings, fixedBills: [...currentSettings.fixedBills, newBill] });
    };

    const updateFixedBill = (id: string, updates: Partial<FixedBill>) => {
        setCurrentSettings({
            ...currentSettings,
            fixedBills: currentSettings.fixedBills.map(bill => bill.id === id ? { ...bill, ...updates } : bill)
        });
    };

    const removeFixedBill = (id: string) => {
        setCurrentSettings({
            ...currentSettings,
            fixedBills: currentSettings.fixedBills.filter(bill => bill.id !== id)
        });
    };

    useEffect(() => {
        let interval: any;
        if (isPurging) {
            const statuses = [
                'Cleaning files...',
                'Deleting receipts...',
                'Clearing history...',
                'Removing profile...',
                'Finishing up...'
            ];
            
            interval = setInterval(() => {
                setPurgeProgress(prev => {
                    const next = prev + (Math.random() * 5);
                    if (next >= 100) {
                        clearInterval(interval);
                        setTimeout(() => onWipeData(), 500);
                        return 100;
                    }
                    const statusIndex = Math.floor((next / 100) * statuses.length);
                    setPurgeStatus(statuses[Math.min(statusIndex, statuses.length - 1)]);
                    return next;
                });
            }, 60);
        }
        return () => clearInterval(interval);
    }, [isPurging, onWipeData]);

    const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        const target = e.target as HTMLInputElement;
        const type = target.type;
        const inputMode = target.inputMode;

        let finalValue: any = value;
        if (type === 'number' || type === 'range' || inputMode === 'numeric') {
            const sanitized = value.replace(/\D/g, '').replace(/^0+/, '');
            finalValue = sanitized === '' ? 0 : Number(sanitized);
        }

        setCurrentSettings(prev => ({
            ...prev,
            [id]: finalValue,
        }));
    };

    const togglePrivacyMode = () => {
        const updated = { ...currentSettings, isPrivacyMode: !currentSettings.isPrivacyMode };
        setCurrentSettings(updated);
        onSave(updated);
    };

    const requestAuth = (action: CriticalAction) => {
        if (!isSecurityEnabled) {
            executeAction(action);
            return;
        }
        setPendingAction(action);
        setAuthPinInput('');
        setAuthError(false);
    };

    const executeAction = (action: CriticalAction) => {
        if (action === 'save_settings') {
            onSave(currentSettings);
            setSaveStatus(true);
            setTimeout(() => setSaveStatus(false), 3000);
        } else if (action === 'disable_security') {
            onSave({ ...currentSettings, pinCode: undefined });
        }
        setPendingAction(null);
    };

    const handleAuthVerify = (e: React.FormEvent) => {
        e.preventDefault();
        if (hashPin(authPinInput) === userSettings.pinCode) {
            if (pendingAction) executeAction(pendingAction);
        } else {
            setAuthError(true);
            setAuthPinInput('');
            setTimeout(() => setAuthError(false), 500);
        }
    };

    const handlePinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPinError(null);
        if (pinFlow === 'entry') {
            if (tempPin.length !== 4) {
                setPinError("PIN must be 4 digits.");
                return;
            }
            setPinFlow('confirm');
        } else if (pinFlow === 'confirm') {
            if (tempPin !== confirmPin) {
                setPinError("PINs don't match.");
                setPinFlow('entry'); setTempPin(''); setConfirmPin('');
                return;
            }
            const updated = { ...currentSettings, pinCode: hashPin(tempPin) };
            onSave(updated);
            setCurrentSettings(updated);
            setPinFlow('idle');
            setTempPin(''); setConfirmPin('');
        }
    };

    return (
        <div className="w-full p-4 sm:p-6 lg:p-8 animate-in fade-in duration-700 max-w-7xl mx-auto relative">
            {pendingAction && (
                <div className="fixed inset-0 z-[300] bg-dark-bg/90 backdrop-blur-md flex items-center justify-center p-6">
                    <div className={`w-full max-w-sm bg-dark-card border ${authError ? 'border-red-500 animate-shake' : 'border-gray-800'} rounded-[40px] p-10 shadow-2xl`}>
                        <div className="text-center mb-8">
                            <h3 className="text-2xl font-bold text-white">Enter PIN</h3>
                            <p className="text-gray-500 text-sm mt-2">Required for security.</p>
                        </div>
                        <form onSubmit={handleAuthVerify} className="space-y-6">
                            <input 
                                type="password" 
                                autoFocus
                                maxLength={4}
                                value={authPinInput}
                                onChange={(e) => setAuthPinInput(e.target.value.replace(/\D/g, ''))}
                                className="w-full bg-gray-900 border-2 border-gray-800 text-white text-center text-4xl p-6 rounded-2xl outline-none font-mono tracking-[1rem]" 
                                placeholder="••••"
                            />
                            <div className="flex gap-4">
                                <button type="button" onClick={() => setPendingAction(null)} className="flex-1 text-gray-400 font-bold">Cancel</button>
                                <button type="submit" className="flex-1 bg-primary text-white font-black py-3 rounded-xl uppercase tracking-widest text-xs">Verify</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <header className="mb-10">
                <h1 className="text-4xl font-bold text-white tracking-tight">Settings</h1>
                <p className="text-gray-400 mt-1 text-lg">Manage your profile and security PIN.</p>
            </header>

            <div className="space-y-10">
                <section className="bg-dark-card border border-gray-800 rounded-[32px] p-8 shadow-xl">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                        <div>
                            <h2 className="text-2xl font-bold text-white">Profile & Plan</h2>
                            <p className="text-gray-500 text-sm">Update your name and monthly targets.</p>
                        </div>
                        <div className="flex gap-4 w-full md:w-auto">
                             <div className="flex-1 md:flex-initial bg-gray-900 border border-gray-800 rounded-2xl px-6 py-3">
                                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Income</p>
                                <p className="text-xl font-bold text-white">{formatCurrency(currentSettings.income, currentSettings.currency, currentSettings.isPrivacyMode)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Your Name</label>
                            <input type="text" id="userName" value={currentSettings.userName} onChange={handleProfileChange} className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl p-4 focus:ring-2 focus:ring-primary outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Currency</label>
                            <select id="currency" value={currentSettings.currency} onChange={handleProfileChange} className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl p-4 focus:ring-2 focus:ring-primary outline-none">
                                {supportedCurrencies.map(cur => (
                                    <option key={cur.code} value={cur.code}>{cur.symbol} - {cur.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-6 mb-10">
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis hide />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px' }}
                                        itemStyle={{ color: '#6C63FF' }}
                                    />
                                    <Line type="monotone" dataKey="value" stroke="#6C63FF" strokeWidth={4} dot={{ fill: '#6C63FF', r: 6 }} activeDot={{ r: 8 }} />
                                    <ReferenceLine y={currentSettings.income} stroke="#10B981" strokeDasharray="3 3" label={{ position: 'top', value: 'Income', fill: '#10B981', fontSize: 12 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 flex justify-between items-center">
                            <p className={`text-xs font-black uppercase tracking-widest ${isOverBudget ? 'text-red-500' : 'text-emerald-500'}`}>
                                {isOverBudget ? 'Allocation exceeds income!' : 'Allocation is healthy'}
                            </p>
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
                                Total Allocated: {formatCurrency(totalAllocated, currentSettings.currency, currentSettings.isPrivacyMode)} / {formatCurrency(currentSettings.income, currentSettings.currency, currentSettings.isPrivacyMode)}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">1. Monthly Income</label>
                                <input 
                                    type="text" 
                                    inputMode="numeric"
                                    id="income" 
                                    value={currentSettings.income === 0 ? '' : currentSettings.income} 
                                    onChange={handleProfileChange} 
                                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl p-4 font-mono focus:border-primary outline-none" 
                                />
                                <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest ml-1">Total to allocate: {formatCurrency(currentSettings.income, currentSettings.currency, currentSettings.isPrivacyMode)}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">3. Monthly Spending Budget</label>
                                <input 
                                    type="text" 
                                    inputMode="numeric"
                                    id="budget" 
                                    value={currentSettings.budget === 0 ? '' : currentSettings.budget} 
                                    onChange={handleProfileChange} 
                                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl p-4 font-mono focus:border-primary outline-none" 
                                />
                                <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest ml-1">Left after spending: {formatCurrency(currentSettings.income - totalFixed - currentSettings.budget, currentSettings.currency, currentSettings.isPrivacyMode)}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">4. Monthly Savings</label>
                                <input 
                                    type="text" 
                                    inputMode="numeric"
                                    id="savings" 
                                    value={currentSettings.savings === 0 ? '' : currentSettings.savings} 
                                    onChange={handleProfileChange} 
                                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl p-4 font-mono focus:border-primary outline-none" 
                                />
                                <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest ml-1">Final Remaining: {formatCurrency(currentSettings.income - totalAllocated, currentSettings.currency, currentSettings.isPrivacyMode)}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">5. Total Savings Goal</label>
                                <input 
                                    type="text" 
                                    inputMode="numeric"
                                    id="savingsGoal" 
                                    value={currentSettings.savingsGoal === 0 ? '' : currentSettings.savingsGoal} 
                                    onChange={handleProfileChange} 
                                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl p-4 font-mono focus:border-primary outline-none" 
                                />
                                <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest ml-1">Target amount to accumulate</p>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-gray-800">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-bold text-white">Enable Buffer Money</h3>
                                        <p className="text-[10px] text-gray-500">Keep some extra cash for unexpected expenses.</p>
                                    </div>
                                    <button 
                                        onClick={() => setCurrentSettings({...currentSettings, isBufferEnabled: !currentSettings.isBufferEnabled})}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${currentSettings.isBufferEnabled ? 'bg-primary' : 'bg-gray-800'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${currentSettings.isBufferEnabled ? 'left-7' : 'left-1'}`} />
                                    </button>
                                </div>

                                {currentSettings.isBufferEnabled && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="flex gap-3">
                                            <input 
                                                type="text" 
                                                inputMode="numeric"
                                                placeholder="Buffer Amount"
                                                value={currentSettings.bufferAmount === 0 ? '' : currentSettings.bufferAmount} 
                                                onChange={e => {
                                                    const val = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
                                                    setCurrentSettings({...currentSettings, bufferAmount: val === '' ? 0 : Number(val)});
                                                }} 
                                                className="flex-grow bg-gray-900 border border-gray-700 text-white rounded-xl p-4 font-mono focus:border-primary outline-none" 
                                            />
                                            <button 
                                                onClick={() => {
                                                    const remaining = currentSettings.income - (currentSettings.budget + totalFixed + currentSettings.savings);
                                                    setCurrentSettings({...currentSettings, bufferAmount: Math.max(0, remaining)});
                                                }}
                                                className="px-4 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary/20 transition-colors"
                                            >
                                                Use Remaining
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">2. Fixed Budget (Bills)</label>
                                <button onClick={addFixedBill} className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {currentSettings.fixedBills.map(bill => (
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
                                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Total Fixed: {formatCurrency(totalFixed, currentSettings.currency, currentSettings.isPrivacyMode)}</p>
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Left: {formatCurrency(currentSettings.income - totalFixed, currentSettings.currency, currentSettings.isPrivacyMode)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-8 flex justify-end items-center gap-4">
                        {saveStatus && (
                            <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-right-4 duration-500">
                                Settings Saved ✓
                            </span>
                        )}
                        <button onClick={() => requestAuth('save_settings')} className="bg-primary hover:bg-primary/90 text-white font-black px-10 py-4 rounded-xl shadow-lg uppercase tracking-widest text-xs">
                            Save Profile
                        </button>
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="bg-dark-card border border-gray-800 rounded-[32px] p-8 shadow-xl flex flex-col justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Private Mode</h2>
                            <p className="text-gray-500 text-sm">Hide dollar amounts on screen.</p>
                        </div>

                        <div onClick={togglePrivacyMode} className={`mt-6 p-6 rounded-2xl border-2 cursor-pointer transition-all ${currentSettings.isPrivacyMode ? 'bg-accent/5 border-accent' : 'bg-gray-900 border-gray-800 border-dashed'}`}>
                            <div className="flex justify-between items-center">
                                <span className={`text-xs font-black uppercase ${currentSettings.isPrivacyMode ? 'text-accent' : 'text-gray-500'}`}>
                                    {currentSettings.isPrivacyMode ? 'Masking ON' : 'Masking OFF'}
                                </span>
                                <div className={`w-12 h-6 rounded-full relative ${currentSettings.isPrivacyMode ? 'bg-accent' : 'bg-gray-700'}`}>
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${currentSettings.isPrivacyMode ? 'left-7' : 'left-1'}`} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-dark-card border border-gray-800 rounded-[32px] p-8 shadow-xl flex flex-col">
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Security PIN</h2>
                            <p className="text-gray-500 text-sm">Lock app behind a passcode.</p>
                        </div>

                        {pinFlow === 'idle' ? (
                            <div className="mt-auto space-y-4">
                                {isSecurityEnabled ? (
                                    <div className="flex gap-4">
                                        <button onClick={() => setPinFlow('entry')} className="flex-1 bg-gray-800 text-[10px] font-black uppercase text-white py-2 rounded-lg border border-gray-700">Change</button>
                                        <button onClick={() => requestAuth('disable_security')} className="flex-1 text-red-500 text-[10px] font-black uppercase bg-red-500/10 py-2 rounded-lg">Disable</button>
                                    </div>
                                ) : (
                                    <button onClick={() => setPinFlow('entry')} className="w-full bg-accent text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs">Enable PIN</button>
                                )}
                            </div>
                        ) : (
                            <form onSubmit={handlePinSubmit} className="space-y-6 mt-4">
                                <input type="password" maxLength={4} value={pinFlow === 'entry' ? tempPin : confirmPin} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); pinFlow === 'entry' ? setTempPin(val) : setConfirmPin(val); }} className="w-full bg-black/40 border-2 border-gray-700 text-white text-center text-4xl p-4 rounded-2xl outline-none" placeholder="••••" />
                                <div className="flex gap-4">
                                    <button type="button" onClick={() => setPinFlow('idle')} className="flex-1 text-gray-400">Cancel</button>
                                    <button type="submit" className="flex-[2] bg-accent text-white py-2 rounded-xl font-black uppercase text-xs">Next</button>
                                </div>
                            </form>
                        )}
                    </div>

                    <div className={`bg-dark-card rounded-[32px] p-8 border-2 shadow-xl flex flex-col border-gray-800`}>
                        <h2 className="text-2xl font-black text-red-600 uppercase tracking-tighter">Reset App</h2>
                        <p className="text-gray-500 text-sm mt-1">Delete all data permanently.</p>
                        
                        {wipeStage === 'idle' && (
                            <button onClick={() => setWipeStage('verify')} className="w-full py-5 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest mt-auto">Clear Everything</button>
                        )}
                        {wipeStage === 'verify' && (
                            <form onSubmit={(e) => { e.preventDefault(); if (hashPin(verifyInput) === userSettings.pinCode) setWipeStage('final'); else setVerifyError(true); }} className="space-y-4 mt-4">
                                <input type="password" maxLength={4} value={verifyInput} onChange={(e) => setVerifyInput(e.target.value.replace(/\D/g, ''))} className="w-full bg-black border-2 border-red-900 text-white text-center text-4xl p-4 rounded-2xl" />
                                <button type="submit" className="w-full bg-red-600 text-white py-3 rounded-xl uppercase text-[10px]">Verify PIN</button>
                            </form>
                        )}
                        {wipeStage === 'final' && (
                             <button onClick={() => onWipeData()} className="w-full bg-red-600 text-white py-4 rounded-xl font-black uppercase mt-auto">Confirm Delete</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;