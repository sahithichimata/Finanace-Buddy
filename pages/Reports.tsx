
import React from 'react';
import type { ReceiptData } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Cell, CartesianGrid } from 'recharts';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';
import { BoltIcon } from '../components/Icons';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Removed manual module augmentation for 'jspdf' to resolve "module not found" compilation error.
// We will use type casting (doc as any) when calling autoTable methods below.

interface ReportsProps {
  receipts: ReceiptData[];
  budget: number;
  currency: string;
  isPrivacyMode?: boolean;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
}

const COLORS = ['#6C63FF', '#00C9A7', '#FF6B6B', '#FFD166', '#4ECDC4', '#FF9F43', '#54A0FF', '#5F27CD'];

const Reports: React.FC<ReportsProps> = ({ receipts, currency, isPrivacyMode = false, selectedMonth, setSelectedMonth }) => {
    const now = new Date();
    
    // Filter receipts for the selected month
    const filteredReceipts = receipts.filter(r => r.transactionDate.startsWith(selectedMonth));
    const totalSpent = filteredReceipts.reduce((sum, r) => sum + r.totalAmount, 0);

    const [viewMode, setViewMode] = React.useState<'daily' | 'monthly'>('daily');

    // Process Category Data
    const categoryData = Object.entries(
        filteredReceipts.reduce((acc, r) => {
            const cat = r.category || 'Others';
            // Added explicit type handling for Record access to avoid arithmetic operation errors
            acc[cat] = ((acc[cat] as number) || 0) + r.totalAmount;
            return acc;
        }, {} as Record<string, number>)
        // Explicitly cast value to number to fix 'unknown' type errors in later mappings
    ).map(([name, value]) => {
        const val = value as number;
        return { 
            name, 
            value: val,
            percentage: totalSpent > 0 ? (val / totalSpent) * 100 : 0
        };
    })
    .sort((a, b) => b.value - a.value);

    // Process Timeline Data
    const timelineData = React.useMemo(() => {
        if (viewMode === 'daily') {
            return Object.entries(
                filteredReceipts.reduce((acc, r) => {
                    const date = r.transactionDate;
                    acc[date] = ((acc[date] as number) || 0) + r.totalAmount;
                    return acc;
                }, {} as Record<string, number>)
            ).map(([date, amount]) => ({ label: date, amount: amount as number }))
            .sort((a, b) => a.label.localeCompare(b.label));
        } else {
            // Monthly view: Last 6 months
            const last6Months = Array.from({ length: 6 }, (_, i) => {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                return d.toISOString().substring(0, 7);
            }).reverse();

            return last6Months.map(month => {
                const monthTotal = receipts
                    .filter(r => r.transactionDate.startsWith(month))
                    .reduce((sum, r) => sum + r.totalAmount, 0);
                return { label: month, amount: monthTotal };
            });
        }
    }, [viewMode, filteredReceipts, receipts, selectedMonth]);

    const avgSpent = filteredReceipts.length > 0 ? totalSpent / filteredReceipts.length : 0;
    const topCategory = categoryData[0]?.name || 'N/A';

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        const symbol = getCurrencySymbol(currency);
        const dateStr = new Date().toLocaleDateString();
        const timeStr = new Date().toLocaleTimeString();

        // Header Styling
        doc.setFillColor(13, 17, 23); // dark-card color
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('FINANCE BUDDY', 20, 25);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('AUTOMATED TRANSACTION STATEMENT', 20, 32);
        
        doc.setTextColor(150, 150, 150);
        doc.text(`Generated on: ${dateStr} at ${timeStr}`, 130, 25);
        doc.text(`Reference: FB-${Math.random().toString(36).substr(2, 9).toUpperCase()}`, 130, 30);

        // Summary Section
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('ACCOUNT SUMMARY', 20, 55);

        // Using type casting to any to call autoTable plugin method
        (doc as any).autoTable({
            startY: 60,
            head: [['Description', 'Value']],
            body: [
                ['Analysis Period', selectedMonth],
                ['Total Spend Volume', `${symbol} ${totalSpent.toFixed(2)}`],
                ['Average Transaction', `${symbol} ${avgSpent.toFixed(2)}`],
                ['Primary Category', topCategory],
                ['Receipts count', filteredReceipts.length.toString()],
            ],
            theme: 'grid',
            headStyles: { fillColor: [108, 99, 255], textColor: 255 },
            styles: { font: 'helvetica', fontSize: 10 }
        });

        // Category Breakdown
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('CATEGORY ALLOCATION', 20, (doc as any).lastAutoTable.finalY + 15);

        // Using type casting to any to call autoTable plugin method
        (doc as any).autoTable({
            startY: (doc as any).lastAutoTable.finalY + 20,
            head: [['Category', 'Amount Allocated', 'Share (%)']],
            // Explicitly cast value as number to fix toFixed and arithmetic operation errors
            body: categoryData.map(c => [
                c.name, 
                `${symbol} ${(c.value as number).toFixed(2)}`,
                `${(((c.value as number) / totalSpent) * 100).toFixed(1)}%`
            ]),
            theme: 'striped',
            headStyles: { fillColor: [0, 201, 167], textColor: 255 },
            styles: { font: 'helvetica', fontSize: 9 }
        });

        // Detailed Ledger
        doc.addPage();
        doc.setFillColor(13, 17, 23);
        doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.text('DETAILED TRANSACTION LEDGER', 20, 13);

        // Using type casting to any to call autoTable plugin method
        (doc as any).autoTable({
            startY: 30,
            head: [['Date', 'Merchant', 'Category', 'Amount']],
            body: [...filteredReceipts]
                .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
                .map(r => [
                    r.transactionDate,
                    r.merchantName,
                    r.category,
                    `${symbol} ${r.totalAmount.toFixed(2)}`
                ]),
            theme: 'striped',
            headStyles: { fillColor: [108, 99, 255], textColor: 255 },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 40 },
                3: { cellWidth: 40, halign: 'right' }
            },
            styles: { font: 'helvetica', fontSize: 8 }
        });

        // Footer on last page
        const finalY = (doc as any).lastAutoTable.finalY;
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('This is a computer-generated document from Finance Buddy. No signature required.', 20, Math.min(finalY + 20, 280));

        doc.save(`FinanceBuddy_Statement_${selectedMonth}_${dateStr.replace(/\//g, '-')}.pdf`);
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const isDate = /^\d{4}-\d{2}-\d{2}$/.test(label);
            const isMonth = /^\d{4}-\d{2}$/.test(label);
            
            let displayLabel = label;
            if (isDate) {
                displayLabel = new Date(label).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
            } else if (isMonth) {
                const [y, m] = label.split('-');
                displayLabel = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
            }

            return (
                <div className="bg-dark-card/90 border border-gray-700 p-5 rounded-[24px] shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200 min-w-[180px]">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3 border-b border-gray-800 pb-2">{displayLabel}</p>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-baseline justify-between gap-4">
                            <p className="text-xl font-black text-white italic tracking-tighter">
                                {formatCurrency(payload[0].value, currency, isPrivacyMode)}
                            </p>
                            {data.percentage !== undefined && (
                                <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                                    {data.percentage.toFixed(1)}%
                                </span>
                            )}
                        </div>
                        {data.percentage !== undefined && (
                            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-primary transition-all duration-1000 ease-out" 
                                    style={{ width: `${data.percentage}%` }} 
                                />
                            </div>
                        )}
                        {(isDate || isMonth) && (
                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">
                                {isDate ? 'Daily Expenditure' : 'Monthly Total'}
                            </p>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full p-4 sm:p-6 lg:p-12 animate-in fade-in duration-500 max-w-[1400px] mx-auto">
            <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-12">
                    <h1 className="text-5xl font-black text-white tracking-tighter italic uppercase flex items-center gap-4">
                        <BoltIcon className="w-10 h-10 text-primary" />
                        Reports
                    </h1>
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
                <button 
                    onClick={handleDownloadPDF}
                    disabled={!filteredReceipts.length}
                    className="group bg-gray-900 border border-gray-800 hover:border-accent text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-3 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-accent group-hover:animate-bounce">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download Statement
                </button>
            </header>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="bg-dark-card border border-gray-800 rounded-[32px] p-8 hover:border-primary/50 transition-all">
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Total Volume</p>
                    <p className="text-4xl font-black text-white italic tracking-tighter">
                        {formatCurrency(totalSpent, currency, isPrivacyMode)}
                    </p>
                </div>
                <div className="bg-dark-card border border-gray-800 rounded-[32px] p-8 hover:border-accent/50 transition-all">
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Avg Transaction</p>
                    <p className="text-4xl font-black text-accent italic tracking-tighter">
                        {formatCurrency(avgSpent, currency, isPrivacyMode)}
                    </p>
                </div>
                <div className="bg-dark-card border border-gray-800 rounded-[32px] p-8 hover:border-primary/50 transition-all">
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Dominant Category</p>
                    <p className="text-4xl font-black text-primary italic tracking-tighter truncate uppercase">
                        {topCategory}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Timeline Chart */}
                <div className="lg:col-span-12 bg-dark-card border border-gray-800 rounded-[48px] p-10 shadow-2xl">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
                        <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Spending Trends</h3>
                        <div className="flex bg-gray-900 p-1 rounded-2xl border border-gray-800">
                            <button 
                                onClick={() => setViewMode('daily')}
                                className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'daily' ? 'bg-primary text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                Daily
                            </button>
                            <button 
                                onClick={() => setViewMode('monthly')}
                                className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'monthly' ? 'bg-accent text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                Monthly
                            </button>
                        </div>
                    </div>
                    <div className="h-80 w-full">
                        {timelineData.length > 0 ? (
                            <ResponsiveContainer>
                                <AreaChart data={timelineData}>
                                    <defs>
                                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={viewMode === 'daily' ? "#6C63FF" : "#00C9A7"} stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor={viewMode === 'daily' ? "#6C63FF" : "#00C9A7"} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                    <XAxis 
                                        dataKey="label" 
                                        stroke="#4b5563" 
                                        fontSize={10} 
                                        tickLine={false} 
                                        axisLine={false}
                                        tickFormatter={(str) => {
                                            if (viewMode === 'daily') {
                                                return new Date(str).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                            } else {
                                                const [y, m] = str.split('-');
                                                return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString(undefined, { month: 'short' });
                                            }
                                        }}
                                    />
                                    <YAxis hide />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: viewMode === 'daily' ? '#6C63FF' : '#00C9A7', strokeWidth: 2, strokeDasharray: '5 5' }} />
                                    <Area 
                                        type="monotone" 
                                        dataKey="amount" 
                                        stroke={viewMode === 'daily' ? "#6C63FF" : "#00C9A7"} 
                                        strokeWidth={4} 
                                        fillOpacity={1} 
                                        fill="url(#colorAmount)"
                                        isAnimationActive={true}
                                        animationDuration={1500}
                                        animationEasing="ease-in-out"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-600 italic">No data for this period</div>
                        )}
                    </div>
                </div>

                {/* Category Distribution Chart */}
                <div className="lg:col-span-12 bg-dark-card border border-gray-800 rounded-[48px] p-10 shadow-2xl">
                    <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-8">Spending by Category</h3>
                    <div className="h-80 w-full">
                        {filteredReceipts.length > 0 ? (
                            <ResponsiveContainer>
                                <BarChart data={categoryData} layout="vertical" margin={{ left: 20, right: 20 }}>
                                    <XAxis type="number" hide />
                                    <YAxis 
                                        dataKey="name" 
                                        type="category" 
                                        stroke="#9ca3af" 
                                        fontSize={10} 
                                        tickLine={false} 
                                        axisLine={false}
                                        width={100}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                    <Bar 
                                        dataKey="value" 
                                        radius={[0, 10, 10, 0]} 
                                        barSize={32}
                                        isAnimationActive={true}
                                        animationDuration={1200}
                                        animationEasing="ease-out"
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-600 italic">No data for this period</div>
                        )}
                    </div>
                </div>
            </div>

            {!filteredReceipts.length && (
                <div className="mt-12 text-center py-20 border-2 border-dashed border-gray-800 rounded-[48px]">
                    <p className="text-gray-600 font-black uppercase tracking-widest italic">No Data Available for {selectedMonth}</p>
                </div>
            )}
        </div>
    );
};

export default Reports;
