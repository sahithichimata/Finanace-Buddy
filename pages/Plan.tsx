
import React, { useMemo } from 'react';
import { UserSettings, ReceiptData } from '../types';
import { formatCurrency } from '../utils/currency';
import { PlanIcon, BoltIcon, PlusIcon, TrashIcon } from '../components/Icons';
import { 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    ReferenceLine,
    AreaChart,
    Area
} from 'recharts';

interface PlanProps {
    userSettings: UserSettings;
    receipts: ReceiptData[];
}

const Plan: React.FC<PlanProps> = ({ userSettings, receipts }) => {
    const { income, budget, savings, fixedBills, currency, isPrivacyMode, isBufferEnabled, bufferAmount, savingsGoal } = userSettings;

    const totalFixed = useMemo(() => fixedBills.reduce((acc, bill) => acc + bill.amount, 0), [fixedBills]);
    const totalAllocated = budget + totalFixed + savings + (isBufferEnabled ? bufferAmount : 0);
    const isOverBudget = totalAllocated > income;

    const totalSavedSoFar = useMemo(() => {
        return receipts.reduce((acc, r) => {
            if (r.category.toLowerCase() === 'savings') {
                return acc + (r.convertedAmount || r.totalAmount);
            }
            return acc;
        }, 0);
    }, [receipts]);

    const savingsProgress = savingsGoal > 0 ? (totalSavedSoFar / savingsGoal) * 100 : 0;
    const monthsToGoal = (savingsGoal > 0 && savings > 0) ? Math.ceil((savingsGoal - totalSavedSoFar) / savings) : 0;

    const chartData = useMemo(() => [
        { name: 'Income', value: income },
        { name: 'Fixed', value: totalFixed },
        { name: 'Spending', value: budget },
        { name: 'Savings', value: savings },
        { name: 'Buffer', value: isBufferEnabled ? bufferAmount : 0 },
        { name: 'Remaining', value: Math.max(0, income - totalAllocated) }
    ], [income, totalFixed, budget, savings, isBufferEnabled, bufferAmount, totalAllocated]);

    const allocationData = useMemo(() => [
        { name: 'Fixed', value: totalFixed, color: '#FF4D4D' },
        { name: 'Spending', value: budget, color: '#6C63FF' },
        { name: 'Savings', value: savings, color: '#00C9A7' },
        { name: 'Buffer', value: isBufferEnabled ? bufferAmount : 0, color: '#F27D26' },
        { name: 'Remaining', value: Math.max(0, income - totalAllocated), color: '#374151' }
    ], [totalFixed, budget, savings, isBufferEnabled, bufferAmount, income, totalAllocated]);

    return (
        <div className="w-full p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 max-w-7xl mx-auto relative">
            <header className="mb-12 relative">
                <div className="flex items-center gap-4 mb-3">
                    <div className="h-[1px] w-12 bg-gradient-to-r from-primary to-transparent" />
                    <span className="text-[9px] font-black text-primary uppercase tracking-[0.5em]">Financial Blueprint</span>
                </div>
                <h1 className="text-6xl font-black text-white italic tracking-tighter uppercase leading-none">
                    The <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-gradient">Plan</span>
                </h1>
                <p className="text-gray-500 mt-4 font-medium italic text-lg opacity-70">
                    Optimizing your <span className="text-white font-bold">{formatCurrency(income, currency, isPrivacyMode)}</span> monthly inflow.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-12">
                {/* Allocation Line Graph */}
                <div className="lg:col-span-8 bg-dark-card/40 border border-white/5 backdrop-blur-3xl rounded-[64px] p-12 shadow-2xl relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-12">
                        <div>
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.5em] mb-2">Income Allocation</h3>
                            <p className="text-gray-400 text-sm font-medium italic">Visualizing your monthly money flow</p>
                        </div>
                        <div className="flex gap-6">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(108,99,255,0.4)]" />
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Allocation</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500/40 border border-emerald-500" />
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Income Line</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: '#6B7280', fontSize: 10, fontWeight: 900 }}
                                    dy={10}
                                />
                                <YAxis hide />
                                <Tooltip 
                                    cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-gray-900/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl">
                                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">{payload[0].payload.name}</p>
                                                    <p className="text-xl font-black text-white italic">{formatCurrency(payload[0].value as number, currency, isPrivacyMode)}</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <ReferenceLine y={income} stroke="#10B981" strokeDasharray="5 5" strokeWidth={2} label={{ position: 'top', value: 'Income Limit', fill: '#10B981', fontSize: 10, fontWeight: 900 }} />
                                <Line 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#6C63FF" 
                                    strokeWidth={4} 
                                    dot={{ fill: '#6C63FF', r: 6, strokeWidth: 2, stroke: '#fff' }} 
                                    activeDot={{ r: 8, strokeWidth: 0 }}
                                    animationDuration={2000}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* AI Advisor Card */}
                <div className="lg:col-span-4 bg-gradient-to-br from-primary via-indigo-900 to-black rounded-[64px] p-12 shadow-neon-primary flex flex-col justify-between group relative overflow-hidden border border-white/10">
                    <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-5 mb-10">
                            <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-xl border border-white/10">
                                <BoltIcon className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <h3 className="text-white font-black italic uppercase text-2xl tracking-tighter leading-none">Advisor_Sync</h3>
                                <p className="text-white/30 text-[8px] font-black uppercase tracking-[0.4em] mt-1">Neural Planning Engine</p>
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div className="bg-black/20 backdrop-blur-xl p-6 rounded-[32px] border border-white/5">
                                <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-3">Optimization Goal</p>
                                <p className="text-white font-medium italic text-lg leading-tight">
                                    {isOverBudget 
                                        ? "Your total allocation exceeds your income by " + formatCurrency(totalAllocated - income, currency, isPrivacyMode) + ". Adjust your spending or fixed bills to stay balanced."
                                        : isBufferEnabled 
                                            ? "Your plan is optimized with a " + formatCurrency(bufferAmount, currency, isPrivacyMode) + " buffer. You have " + formatCurrency(income - totalAllocated, currency, isPrivacyMode) + " remaining."
                                            : "Your plan is sustainable. You have " + formatCurrency(income - totalAllocated, currency, isPrivacyMode) + " unallocated, which is great for a buffer."}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 p-5 rounded-[28px] border border-white/5">
                                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Health Score</p>
                                    <p className="text-2xl font-black text-white italic">{isOverBudget ? '42' : '94'}<span className="text-xs text-gray-500 not-italic ml-1">/100</span></p>
                                </div>
                                <div className="bg-white/5 p-5 rounded-[28px] border border-white/5">
                                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Efficiency</p>
                                    <p className="text-2xl font-black text-white italic">{Math.round((totalAllocated / income) * 100)}%</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 mt-10">
                        <button className="w-full py-5 bg-white text-primary rounded-[28px] text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 shadow-2xl">
                            Recalculate Strategy
                        </button>
                    </div>
                </div>
            </div>

            {/* Savings Goal Progress */}
            {savingsGoal > 0 && (
                <div className="mb-12 bg-dark-card/40 border border-white/5 backdrop-blur-3xl rounded-[64px] p-12 shadow-2xl relative overflow-hidden group">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-10">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
                                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.5em]">Savings Goal Progress</h3>
                            </div>
                            <p className="text-white text-3xl font-black italic tracking-tighter uppercase">
                                Target: {formatCurrency(savingsGoal, currency, isPrivacyMode)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Estimated Completion</p>
                            <p className="text-2xl font-black text-emerald-400 italic">
                                {monthsToGoal > 0 ? `${monthsToGoal} Months` : 'Goal Reached!'}
                            </p>
                        </div>
                    </div>

                    <div className="relative pt-4">
                        <div className="flex justify-between items-end mb-4">
                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                                Progress: {Math.round(savingsProgress)}%
                            </span>
                            <span className="text-xs font-black text-white italic">
                                {formatCurrency(totalSavedSoFar, currency, isPrivacyMode)} Saved
                            </span>
                        </div>
                        <div className="w-full h-8 bg-black/40 rounded-full overflow-hidden border border-white/5 p-1.5 backdrop-blur-xl">
                            <div 
                                className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 rounded-full transition-all duration-2000 ease-out relative overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                                style={{ width: `${Math.min(100, savingsProgress)}%` }}
                            >
                                <div className="absolute inset-0 bg-white/10 animate-pulse" />
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-100%] animate-shine" />
                            </div>
                        </div>
                        <div className="flex justify-between mt-4 text-[9px] font-black text-gray-600 uppercase tracking-[0.3em]">
                            <span>Start</span>
                            <span>{formatCurrency(savingsGoal, currency, isPrivacyMode)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Detailed Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                {[
                    { 
                        title: 'Fixed Budget', 
                        current: totalFixed, 
                        color: 'text-red-400', 
                        bg: 'from-red-500/10',
                        desc: 'Rent, bills, and non-negotiables',
                        items: fixedBills
                    },
                    { 
                        title: 'Spending Budget', 
                        current: budget, 
                        color: 'text-primary', 
                        bg: 'from-primary/10',
                        desc: 'Daily expenses and lifestyle',
                        items: []
                    },
                    { 
                        title: 'Monthly Savings', 
                        current: savings, 
                        color: 'text-emerald-400', 
                        bg: 'from-emerald-500/10',
                        desc: 'Future wealth and emergency fund',
                        items: []
                    },
                    { 
                        title: 'Buffer Money', 
                        current: isBufferEnabled ? bufferAmount : 0, 
                        color: 'text-orange-400', 
                        bg: 'from-orange-500/10',
                        desc: 'Safety net for unexpected costs',
                        items: []
                    }
                ].map((item, i) => (
                    <div key={i} className={`bg-gradient-to-br ${item.bg} to-transparent border border-white/5 backdrop-blur-xl rounded-[48px] p-10 relative overflow-hidden group hover:-translate-y-1 transition-all duration-500`}>
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-1">{item.title}</h4>
                                <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest italic">{item.desc}</p>
                            </div>
                            <div className={`text-xs font-black italic ${item.color}`}>
                                {Math.round((item.current / income) * 100)}%
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Allocated</span>
                                <span className="text-2xl font-black text-white italic">{formatCurrency(item.current, currency, isPrivacyMode)}</span>
                            </div>
                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full bg-current rounded-full ${item.color}`} 
                                    style={{ width: `${(item.current / income) * 100}%` }} 
                                />
                            </div>
                            
                            {item.items.length > 0 && (
                                <div className="pt-4 mt-4 border-t border-white/5 space-y-2">
                                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-2">Breakdown</p>
                                    {item.items.map(bill => (
                                        <div key={bill.id} className="flex justify-between items-center">
                                            <span className="text-[10px] text-gray-400">{bill.name}</span>
                                            <span className="text-[10px] font-mono text-white">{formatCurrency(bill.amount, currency, isPrivacyMode)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Plan;
