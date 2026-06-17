
import React, { useState, useEffect } from 'react';
import type { ReceiptData, UserSettings, Page } from '../types';
import { getSpendingInsight } from '../services/geminiService';
import { getSpendingForecast, detectAnomalies } from '../services/mlService';
import { formatCurrency } from '../utils/currency';
import { FinanceBuddyIcon, BoltIcon, ReceiptsIcon, PlanIcon } from '../components/Icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

interface DashboardProps {
  receipts: ReceiptData[];
  userSettings: UserSettings;
  onNavigate?: (page: Page) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
}

const COLORS = ['#6C63FF', '#00C9A7', '#FF6B6B', '#FFD166', '#4ECDC4', '#1A535C', '#8884d8', '#82ca9d'];

const Dashboard: React.FC<DashboardProps> = ({ receipts, userSettings, onNavigate, selectedMonth, setSelectedMonth }) => {
    const { userName, budget, currency, isPrivacyMode, income, fixedBills = [] } = userSettings;
    const [insight, setInsight] = useState<string | null>(null);
    const [isInsightLoading, setIsInsightLoading] = useState<boolean>(true);
    
    const now = new Date();

    const [year, month] = selectedMonth.split('-').map(Number);
    const forecast = getSpendingForecast(receipts, budget, month - 1, year);
    const anomalies = detectAnomalies(receipts);

    useEffect(() => {
        const fetchInsight = async () => {
            if (receipts.length === 0) {
                setIsInsightLoading(false);
                setInsight("Secure your financial future. Upload a receipt to start analysis.");
                return;
            }
            setIsInsightLoading(true);
            try {
                const generatedInsight = await getSpendingInsight(receipts, userSettings, selectedMonth);
                setInsight(generatedInsight);
            } catch {
                setInsight("ML Engine currently processing your latest logs.");
            } finally {
                setIsInsightLoading(false);
            }
        };
        fetchInsight();
    }, [receipts, userSettings, selectedMonth]);

    // Added explicit type conversion to resolve arithmetic operation type errors
    const fixedSpent = fixedBills.reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0);
    const totalSpentThisMonth = forecast.thisMonthTotal;
    const remainingBudget = Math.max(0, budget - totalSpentThisMonth);
    const budgetUsagePercent = budget > 0 ? (totalSpentThisMonth / budget) * 100 : 0;
    const disposableCash = Math.max(0, income - fixedSpent);
    
    // Calculate daily limit based on remaining days in the selected month
    const getRemainingDays = () => {
        if (!forecast.isCurrentMonth) return 0;
        const daysInMonth = new Date(year, month, 0).getDate();
        return Math.max(1, daysInMonth - now.getDate());
    };
    const remainingDays = getRemainingDays();
    const dailyLimit = remainingDays > 0 ? Math.max(0, (budget - totalSpentThisMonth) / remainingDays) : 0;

    // Filter receipts for the selected month for charts
    const filteredReceipts = receipts.filter(r => r.transactionDate.startsWith(selectedMonth));

    const chartData = Object.entries(
        filteredReceipts.reduce((acc, r) => {
            const cat = r.category || 'Others';
            acc[cat] = (acc[cat] || 0) + (r.convertedAmount || r.totalAmount);
            return acc;
        }, {} as Record<string, number>)
    ).map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

    const allocationData = [
        { name: 'Fixed', value: fixedSpent, color: '#FF6B6B' },
        { name: 'Budget', value: budget, color: '#6C63FF' },
        { name: 'Savings', value: userSettings.savings, color: '#00C9A7' },
        { name: 'Buffer', value: userSettings.isBufferEnabled ? userSettings.bufferAmount : 0, color: '#F27D26' },
        { name: 'Other', value: Math.max(0, income - fixedSpent - budget - userSettings.savings - (userSettings.isBufferEnabled ? userSettings.bufferAmount : 0)), color: '#374151' }
    ].filter(item => item.value > 0);

    const topCategory = chartData[0]?.name || 'None';
    const hasData = receipts.length > 0;

    return (
        <div className="w-full p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 max-w-7xl mx-auto relative">
            {/* Global Noise Overlay */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-[100] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
            
            <header className="mb-16 flex flex-col md:flex-row justify-between items-start md:items-center gap-10 relative">
                <div className="absolute -top-24 -left-24 w-80 h-80 bg-primary/10 blur-[120px] rounded-full pointer-events-none animate-pulse" />
                <div className="relative z-10">
                    <p className="text-gray-500 mt-4 font-medium italic text-xl opacity-70 flex items-center gap-3">
                        <span className="w-1 h-1 rounded-full bg-emerald-500" />
                        Authorized Access: <span className="text-white font-bold tracking-tight">{userName || 'User'}</span>
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-5 relative z-10">
                    {/* Month Selector */}
                    <div className="bg-white/5 border border-white/10 backdrop-blur-xl px-6 py-3 rounded-2xl flex items-center gap-4 shadow-2xl">
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Analysis Period:</span>
                        <input 
                            type="month" 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            max={now.toISOString().substring(0, 7)}
                            className="bg-transparent text-white font-black uppercase text-xs outline-none cursor-pointer [color-scheme:dark]"
                        />
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-16">
                {/* Main Budget Health Card */}
                <div className="lg:col-span-8 bg-dark-card/40 border border-white/5 backdrop-blur-3xl rounded-[64px] p-14 shadow-2xl relative overflow-hidden group min-h-[420px] flex flex-col justify-between transition-all duration-700 hover:border-white/10 hover:shadow-primary/10">
                    {/* Holographic Shine Effect */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none">
                        <div className="absolute -inset-[100%] bg-gradient-to-tr from-transparent via-white/5 to-transparent rotate-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-[2000ms] ease-in-out" />
                    </div>

                    {/* Background Data-Stream SVG */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                        <svg className="w-full h-full" viewBox="0 0 800 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M0 250C100 250 150 150 200 150C250 150 300 350 350 350C400 350 450 200 500 200C550 200 600 300 700 300C800 300 850 250 900 250" stroke="url(#pulse-1)" strokeWidth="2" strokeLinecap="round" className="animate-pulse" style={{ animationDuration: '3s' }} />
                            <path d="M0 200C120 200 180 100 240 100C300 100 360 300 420 300C480 300 540 150 600 150C660 150 720 250 840 250" stroke="url(#pulse-2)" strokeWidth="1" strokeLinecap="round" className="animate-pulse opacity-50" style={{ animationDuration: '5s' }} />
                            <defs>
                                <linearGradient id="pulse-1" x1="0" y1="0" x2="800" y2="0" gradientUnits="userSpaceOnUse">
                                    <stop stopColor="#6C63FF" />
                                    <stop offset="1" stopColor="#00C9A7" />
                                </linearGradient>
                                <linearGradient id="pulse-2" x1="0" y1="0" x2="800" y2="0" gradientUnits="userSpaceOnUse">
                                    <stop stopColor="#00C9A7" />
                                    <stop offset="1" stopColor="#6C63FF" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>

                    <div className="absolute -top-24 -right-24 p-10 opacity-[0.02] group-hover:opacity-[0.08] transition-all duration-1000 group-hover:scale-110 group-hover:rotate-6">
                        <BoltIcon className="w-96 h-96 text-primary" />
                    </div>
                    
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-16">
                            <div>
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_#6C63FF]" />
                                    <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.5em]">
                                        {forecast.isCurrentMonth ? 'Available Balance' : 'Remaining Budget'}
                                    </h2>
                                </div>
                                <div className="relative">
                                    <p className="text-8xl font-black text-white italic tracking-tighter leading-none drop-shadow-2xl">
                                        {formatCurrency(remainingBudget, currency, isPrivacyMode)}
                                    </p>
                                    <div className="absolute -right-12 top-0 text-[10px] font-black text-primary/40 vertical-text tracking-widest uppercase">
                                        {forecast.isCurrentMonth ? 'Live' : 'Archive'}
                                    </div>
                                </div>
                                <p className="text-gray-500 font-bold uppercase text-[11px] mt-6 tracking-[0.3em] italic opacity-50 flex items-center gap-3">
                                    <span className="h-[1px] w-8 bg-gray-800" />
                                    {forecast.isCurrentMonth ? 'Money left for this month' : `Final balance for ${selectedMonth}`}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-gray-600 text-[9px] font-black uppercase tracking-[0.4em] mb-3 opacity-40">Financial Status</p>
                                <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] border border-white/10 backdrop-blur-xl bg-white/5 text-white">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                    AI Monitored
                                </div>
                            </div>
                        </div>

                        {!hasData ? (
                            <div className="py-32 text-center border border-white/5 rounded-[64px] flex flex-col items-center justify-center bg-white/[0.02] backdrop-blur-2xl group/empty transition-all hover:bg-white/[0.04] relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-50" />
                                <div className="relative z-10 flex flex-col items-center">
                                    <div className="w-24 h-24 bg-primary/10 rounded-[40px] flex items-center justify-center mb-10 border border-primary/20 shadow-neon-primary group-hover/empty:scale-110 group-hover/empty:rotate-3 transition-all duration-700">
                                        <ReceiptsIcon className="w-12 h-12 text-primary" />
                                    </div>
                                    <h3 className="text-white text-3xl font-black uppercase tracking-tighter italic mb-4">
                                        Your Financial Journey Starts Here
                                    </h3>
                                    <p className="text-gray-400 text-sm font-medium max-w-md leading-relaxed mb-12 opacity-80">
                                        Ready to take control of your wealth? Upload your first receipt and let AI Buddy transform your raw data into powerful financial intelligence.
                                    </p>
                                    <button 
                                        onClick={() => onNavigate?.('addReceipt')}
                                        className="px-10 py-5 bg-primary hover:bg-primary/90 text-white rounded-[24px] text-xs font-black uppercase tracking-[0.3em] transition-all active:scale-95 shadow-neon-primary flex items-center gap-4 group/btn"
                                    >
                                        <span>Upload First Receipt</span>
                                        <BoltIcon className="w-4 h-4 group-hover/btn:animate-pulse" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-12">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {[
                                        { label: forecast.isCurrentMonth ? 'Spent This Month' : 'Total Spent', value: totalSpentThisMonth, sub: 'Total Expenses' },
                                        { label: forecast.isCurrentMonth ? 'Daily Average' : 'Avg Daily Burn', value: forecast.velocity, sub: 'Spending Speed', unit: '/day' },
                                        { label: forecast.isCurrentMonth ? 'Month-End Forecast' : 'Budget Efficiency', value: forecast.isCurrentMonth ? forecast.projectedTotal : (budget - totalSpentThisMonth), sub: forecast.isCurrentMonth ? 'AI Prediction' : 'Final Savings', highlight: true }
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-white/[0.02] p-8 rounded-[40px] border border-white/5 hover:bg-white/[0.04] transition-all duration-500 group/stat hover:-translate-y-1">
                                            <div className="flex justify-between items-center mb-4">
                                                <p className="text-gray-500 text-[9px] font-black uppercase tracking-[0.3em] group-hover/stat:text-primary transition-colors">{stat.label}</p>
                                                <div className="w-1 h-1 rounded-full bg-gray-800 group-hover/stat:bg-primary transition-colors" />
                                            </div>
                                            <p className={`text-4xl font-black italic tracking-tighter ${stat.highlight ? (forecast.isHealthy ? 'text-emerald-400' : 'text-red-400') : 'text-white'}`}>
                                                {formatCurrency(stat.value, currency, isPrivacyMode)}
                                                {stat.unit && <span className="text-xs text-gray-600 not-italic ml-1 font-bold">{stat.unit}</span>}
                                            </p>
                                            <p className="text-[9px] text-gray-600 font-black uppercase tracking-[0.2em] mt-3 opacity-60">{stat.sub}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="relative pt-8">
                                    <div className="flex justify-between items-end mb-5">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Budget Used</span>
                                            <span className="text-[8px] font-bold text-gray-700 uppercase tracking-widest px-2 py-0.5 bg-white/5 rounded-md">Live</span>
                                        </div>
                                        <span className={`text-2xl font-black italic tracking-tighter ${budgetUsagePercent > 90 ? 'text-red-500' : 'text-white'}`}>
                                            {Math.round(budgetUsagePercent)}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-black/40 h-6 rounded-full overflow-hidden border border-white/5 p-2 backdrop-blur-xl shadow-inner">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-2000 ease-out relative overflow-hidden ${
                                                budgetUsagePercent > 90 ? 'bg-gradient-to-r from-red-700 via-red-500 to-red-400 shadow-[0_0_30px_rgba(239,68,68,0.5)]' : 
                                                budgetUsagePercent > 70 ? 'bg-gradient-to-r from-orange-600 to-orange-400' : 
                                                'bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-gradient shadow-[0_0_30px_rgba(108,99,255,0.4)]'
                                            }`} 
                                            style={{ width: `${Math.min(100, budgetUsagePercent)}%` }} 
                                        >
                                            <div className="absolute inset-0 bg-white/10 animate-pulse" />
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-100%] animate-shine" />
                                        </div>
                                    </div>
                                    <div className="flex justify-between mt-5 text-[9px] font-black text-gray-600 uppercase tracking-[0.4em]">
                                        <span className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-gray-800" /> Start</span>
                                        <span className="text-gray-400">Monthly Limit: {formatCurrency(budget, currency, isPrivacyMode)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* AI Assistant Insight Card */}
                <div className="lg:col-span-4 bg-gradient-to-br from-primary via-indigo-900 to-black rounded-[40px] p-8 shadow-neon-primary flex flex-col justify-between group relative overflow-hidden border border-white/10 transition-all duration-700 hover:shadow-[0_0_60px_rgba(108,99,255,0.3)]">
                    <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent)] pointer-events-none" />
                    <div className="absolute -bottom-10 -right-10 opacity-[0.08] group-hover:scale-110 group-hover:-rotate-12 transition-all duration-1000 group-hover:opacity-20">
                        <FinanceBuddyIcon className="w-64 h-64 text-white" />
                    </div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-2xl border border-white/10 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                                <FinanceBuddyIcon className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-white font-black italic uppercase text-xl tracking-tighter leading-none">AI Insight</h3>
                                <p className="text-white/30 text-[8px] font-black uppercase tracking-[0.4em] mt-1">Neural Analysis Active</p>
                            </div>
                        </div>
                        
                        <div className="min-h-[140px] flex items-start bg-black/20 backdrop-blur-3xl rounded-[32px] p-6 border border-white/5 relative group/insight transition-all hover:bg-black/30">
                            {isInsightLoading ? (
                                <div className="animate-pulse space-y-4 w-full">
                                    <div className="h-2 bg-white/10 rounded-full w-full" />
                                    <div className="h-2 bg-white/10 rounded-full w-11/12" />
                                    <div className="h-2 bg-white/10 rounded-full w-4/5" />
                                </div>
                            ) : (
                                <div className="relative">
                                    <span className="text-white/20 text-4xl font-serif absolute -top-4 -left-2 select-none">"</span>
                                    <p className="text-white font-medium leading-relaxed italic text-lg tracking-tight relative z-10">
                                        {insight}
                                    </p>
                                    <span className="text-white/20 text-4xl font-serif absolute -bottom-6 right-0 select-none">"</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <button 
                        onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'financeBuddy' }))} 
                        className="relative z-10 mt-6 w-full py-4 bg-white text-primary hover:bg-gray-50 rounded-[24px] text-[10px] font-black uppercase tracking-[0.3em] transition-all active:scale-95 shadow-2xl flex items-center justify-center gap-3 group/btn overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-primary/5 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
                        <span className="relative z-10">Consult AI Buddy</span>
                        <BoltIcon className="w-4 h-4 relative z-10 group-hover/btn:animate-pulse" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-16">
                {/* Salary Allocation Chart */}
                <div className="lg:col-span-8 bg-dark-card/40 border border-white/5 backdrop-blur-3xl rounded-[64px] p-14 shadow-2xl relative overflow-hidden transition-all duration-700 hover:border-white/10 group">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8 mb-14">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-2 h-2 rounded-full bg-accent" />
                                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.5em]">Monthly Spending Plan</h3>
                            </div>
                            <p className="text-gray-400 text-base font-medium italic">Total Income: <span className="text-white font-bold tracking-tight">{formatCurrency(income, currency, isPrivacyMode)}</span></p>
                        </div>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => onNavigate?.('plan')}
                                className="hidden sm:flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2.5 rounded-2xl transition-all group/btn"
                            >
                                <PlanIcon className="w-4 h-4 text-primary group-hover/btn:scale-110 transition-transform" />
                                <span className="text-[10px] font-black text-white uppercase tracking-widest">View Strategy</span>
                            </button>
                            <div className="flex flex-wrap gap-4">
                                {allocationData.map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-white/[0.03] px-5 py-2.5 rounded-2xl border border-white/5 hover:bg-white/[0.06] transition-colors cursor-default">
                                        <div className="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.1)]" style={{ backgroundColor: item.color }} />
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="h-32 w-full flex items-center gap-3">
                        {allocationData.map((item, i) => (
                            <div 
                                key={i} 
                                className="h-20 first:rounded-l-[32px] last:rounded-r-[32px] transition-all duration-700 hover:h-24 hover:shadow-2xl relative group/bar cursor-pointer overflow-hidden"
                                style={{ 
                                    width: `${(item.value / income) * 100}%`,
                                    backgroundColor: item.color,
                                    boxShadow: `0 0 30px ${item.color}15`
                                }}
                            >
                                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-30" />
                                
                                <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-gray-900 border border-white/10 px-5 py-3 rounded-2xl text-[11px] font-black text-white opacity-0 group-hover/bar:opacity-100 transition-all duration-500 whitespace-nowrap z-20 shadow-2xl translate-y-4 group-hover/bar:translate-y-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                        {item.name}: {formatCurrency(item.value, currency, isPrivacyMode)}
                                        <span className="text-gray-500 font-bold">[{Math.round((item.value / income) * 100)}%]</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-3 gap-10 mt-12">
                        {[
                            { label: 'Fixed Costs', val: fixedSpent, color: 'text-red-400', icon: 'FIX' },
                            { label: 'Spending Budget', val: budget, color: 'text-primary', icon: 'BUD' },
                            { label: 'Savings & Other', val: Math.max(0, income - fixedSpent - budget), color: 'text-emerald-400', icon: 'SAV' }
                        ].map((stat, i) => (stat.val > 0 && (
                            <div key={i} className="text-center p-6 rounded-[32px] bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] transition-all group/ratio">
                                <div className="flex justify-center items-center gap-2 mb-2">
                                    <span className="text-[7px] font-black text-gray-700 tracking-widest bg-white/5 px-1.5 py-0.5 rounded">{stat.icon}</span>
                                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.4em] group-hover/ratio:text-gray-400 transition-colors">{stat.label}</p>
                                </div>
                                <p className={`text-2xl font-black italic tracking-tighter ${stat.color}`}>{Math.round((stat.val / income) * 100)}%</p>
                            </div>
                        )))}
                    </div>
                </div>

                {/* Highlighted Stats */}
                <div className="lg:col-span-4 grid grid-cols-1 gap-8">
                    <div className="bg-gradient-to-br from-red-500/10 via-transparent to-transparent border border-red-500/20 backdrop-blur-3xl rounded-[48px] p-12 relative overflow-hidden group hover:shadow-[0_0_40px_rgba(239,68,68,0.15)] transition-all duration-700 hover:-translate-y-2">
                        <div className="absolute top-8 right-8 text-red-500/10 group-hover:text-red-500/20 transition-all duration-1000 group-hover:scale-125 group-hover:rotate-12">
                            <ReceiptsIcon className="w-20 h-20" />
                        </div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_10px_#EF4444]" />
                            <p className="text-[10px] font-black text-red-400/80 uppercase tracking-[0.4em]">Fixed Expenses</p>
                        </div>
                        <p className="text-6xl font-black text-white italic tracking-tighter leading-none">{formatCurrency(fixedSpent, currency, isPrivacyMode)}</p>
                        <div className="flex items-center gap-3 mt-6">
                            <div className="h-[1px] w-6 bg-red-500/30" />
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em] italic">Bills & Commitments</p>
                        </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent border border-emerald-500/20 backdrop-blur-3xl rounded-[48px] p-12 relative overflow-hidden group hover:shadow-[0_0_40px_rgba(16,185,129,0.15)] transition-all duration-700 hover:-translate-y-2">
                        <div className="absolute top-8 right-8 text-emerald-500/10 group-hover:text-emerald-500/20 transition-all duration-1000 group-hover:scale-125 group-hover:rotate-12">
                            <BoltIcon className="w-20 h-20" />
                        </div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10B981]" />
                            <p className="text-[10px] font-black text-emerald-400/80 uppercase tracking-[0.4em]">Spending Power</p>
                        </div>
                        <p className="text-6xl font-black text-white italic tracking-tighter leading-none">{formatCurrency(disposableCash, currency, isPrivacyMode)}</p>
                        <div className="flex items-center gap-3 mt-6">
                            <div className="h-[1px] w-6 bg-emerald-500/30" />
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em] italic">Money for Spending</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Daily Limit Card */}
                <div className="lg:col-span-4 bg-gradient-to-br from-primary/10 via-transparent to-transparent border border-primary/20 backdrop-blur-3xl rounded-[48px] p-12 relative overflow-hidden group hover:shadow-[0_0_40px_rgba(108,99,255,0.15)] transition-all duration-700 hover:-translate-y-2">
                    <div className="absolute top-8 right-8 text-primary/10 group-hover:text-primary/20 transition-all duration-1000 group-hover:scale-125 group-hover:rotate-12">
                        <BoltIcon className="w-20 h-20" />
                    </div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_#6C63FF]" />
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">
                            {forecast.isCurrentMonth ? 'Daily Limit' : 'Avg Daily Spend'}
                        </p>
                    </div>
                    <p className="text-6xl font-black text-white italic tracking-tighter leading-none">
                        {formatCurrency(forecast.isCurrentMonth ? dailyLimit : forecast.velocity, currency, isPrivacyMode)}
                    </p>
                    <div className="flex items-center gap-3 mt-6">
                        <div className="h-[1px] w-6 bg-primary/30" />
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em] italic">
                            {forecast.isCurrentMonth ? 'Safe Daily Spending' : 'Historical Daily Average'}
                        </p>
                    </div>
                </div>

                {/* Category Mix Card */}
                <div className="lg:col-span-8 bg-dark-card/40 border border-white/5 backdrop-blur-3xl rounded-[64px] p-14 shadow-2xl relative overflow-hidden transition-all duration-700 hover:border-white/10 group">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8 mb-14">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-2 h-2 rounded-full bg-primary" />
                                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.5em]">Spending by Sector</h3>
                            </div>
                            <p className="text-gray-400 text-base font-medium italic">Top Category: <span className="text-white font-bold tracking-tight">{topCategory}</span></p>
                        </div>
                        <div className="flex flex-wrap gap-4">
                            {chartData.slice(0, 4).map((item, i) => (
                                <div key={i} className="flex items-center gap-3 bg-white/[0.02] px-5 py-2.5 rounded-2xl border border-white/5 hover:bg-white/[0.05] transition-colors">
                                    <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">{item.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="h-80 relative">
                        {hasData ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={chartData} 
                                        cx="50%" 
                                        cy="50%" 
                                        innerRadius={105} 
                                        outerRadius={135} 
                                        paddingAngle={10} 
                                        dataKey="value"
                                        animationDuration={2500}
                                        stroke="none"
                                    >
                                        {chartData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-all duration-700 cursor-pointer outline-none" />)}
                                    </Pie>
                                    <Legend 
                                        verticalAlign="middle" 
                                        align="right" 
                                        layout="vertical"
                                        iconType="circle" 
                                        wrapperStyle={{ 
                                            fontSize: '11px', 
                                            textTransform: 'uppercase', 
                                            fontWeight: 900, 
                                            letterSpacing: '0.3em', 
                                            paddingLeft: '60px',
                                            color: '#9CA3AF',
                                            opacity: 0.6
                                        }} 
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full opacity-10 text-center">
                                <ReceiptsIcon className="w-24 h-24 mb-10" />
                                <p className="text-base font-black uppercase tracking-[0.4em] italic">Sector_Data_Missing</p>
                            </div>
                        )}
                        
                        {hasData && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                                <div className="bg-white/[0.01] backdrop-blur-3xl w-40 h-40 rounded-full border border-white/5 flex flex-col items-center justify-center shadow-2xl relative group-hover:scale-110 transition-transform duration-700">
                                    <div className="absolute inset-0 rounded-full bg-primary/5 animate-pulse" />
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.4em] mb-2">Aggregate</p>
                                    <p className="text-2xl font-black text-white italic leading-none tracking-tighter">{formatCurrency(totalSpentThisMonth, currency, isPrivacyMode)}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
