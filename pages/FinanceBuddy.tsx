
import React, { useState, useEffect, useRef } from 'react';
import type { ChatMessage, ReceiptData, UserSettings, Category } from '../types';
import { getFinanceBuddyStream, textToSpeech } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioUtils';
import { FinanceBuddyIcon, LoaderIcon, MicrophoneIcon, SendIcon, StopIcon, BoltIcon, ProfileIcon, ReceiptsIcon } from '../components/Icons';

interface FinanceBuddyProps {
    currency: string;
    receipts: ReceiptData[];
    userSettings: UserSettings;
    categories: Category[];
}

const FinanceBuddy: React.FC<FinanceBuddyProps> = ({ currency, receipts, userSettings, categories }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages, isLoading]);

    const handleSendMessage = async (textToUse?: string) => {
        const text = (textToUse || userInput).trim();
        if (!text || isLoading) return;

        setMessages(prev => [...prev, { sender: 'user', text }]);
        setUserInput('');
        setIsLoading(true);

        // NEURAL GEMINI RAG FLOW
        try {
            let fullAiText = '';
            setMessages(prev => [...prev, { sender: 'ai', text: '' }]);

            const stream = getFinanceBuddyStream(text, receipts, userSettings);
            for await (const chunk of stream) {
                fullAiText += chunk;
                
                // Extract unique REF IDs from the text
                const refMatches = fullAiText.match(/\[REF: ([^\]]+)\]/g);
                const evidenceIds = refMatches 
                    ? Array.from(new Set(refMatches.map(m => m.replace('[REF: ', '').replace(']', ''))))
                    : [];

                setMessages(prev => {
                    const next = [...prev];
                    next[next.length - 1] = { 
                        sender: 'ai', 
                        text: fullAiText,
                        evidenceIds: evidenceIds.length > 0 ? evidenceIds : undefined
                    };
                    return next;
                });
            }

            if (fullAiText.length < 300) {
                const audioData = await textToSpeech(fullAiText);
                if (audioData) {
                    if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const buffer = await decodeAudioData(decode(audioData), audioContextRef.current, 24000, 1);
                    const source = audioContextRef.current.createBufferSource();
                    source.buffer = buffer;
                    source.connect(audioContextRef.current.destination);
                    source.start();
                }
            }
        } catch (error) {
            setMessages(prev => [...prev, { sender: 'ai', text: "Neural link interrupted. Please try again in a moment." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const ReceiptEvidence = ({ receipt, currency }: { receipt: ReceiptData, currency: string }) => {
        const category = categories.find(c => c.name.toLowerCase() === receipt.category.toLowerCase());
        const icon = category?.icon || '📦';

        return (
            <div className="flex-shrink-0 w-44 bg-gray-900 border border-gray-800 rounded-2xl p-3 space-y-2 hover:border-primary/50 transition-all cursor-default group animate-in zoom-in-95 duration-300 shadow-lg">
                <div className="flex items-center justify-between mb-1">
                    <div className="w-6 h-6 rounded-lg bg-gray-800 flex items-center justify-center text-xs">
                        {icon}
                    </div>
                    <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">
                        {new Date(receipt.transactionDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                </div>
                
                <div className="space-y-0.5">
                    <h4 className="text-[10px] font-black text-white uppercase truncate tracking-tight leading-none group-hover:text-primary transition-colors">
                        {receipt.merchantName}
                    </h4>
                    <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">
                        {receipt.category}
                    </p>
                </div>

                <div className="pt-1 border-t border-gray-800 flex items-baseline justify-between">
                    <span className="text-xs font-black text-white italic tracking-tighter">
                        {new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(receipt.convertedAmount || receipt.totalAmount)}
                    </span>
                    <ReceiptsIcon className="w-3 h-3 text-gray-700 group-hover:text-primary/30 transition-colors" />
                </div>
            </div>
        );
    };

    return (
        <div className="w-full h-full flex flex-col p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500 overflow-hidden">
            <header className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
                        <FinanceBuddyIcon className="w-8 h-8 text-primary" />
                        AI Buddy
                    </h1>
                </div>
            </header>

            <div className="flex-grow bg-dark-card border border-gray-800 rounded-[48px] shadow-2xl overflow-hidden flex flex-col transition-colors duration-500">
                <div ref={chatContainerRef} className="flex-grow overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-8">
                            <div className="w-24 h-24 rounded-[32px] flex items-center justify-center bg-primary/20 shadow-neon-primary">
                                <FinanceBuddyIcon className="w-12 h-12 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                                    Ask AI Buddy
                                </h3>
                                <p className="text-gray-500 mt-2">
                                    Neural generation enabled. I will provide smart, conversational insights based on your spending data.
                                </p>
                            </div>
                        </div>
                    )}

                    {messages.map((msg, index) => (
                        <div key={index} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-4 duration-500`}>
                            <div className={`flex gap-4 max-w-[95%] sm:max-w-[80%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className={`w-10 h-10 rounded-[16px] flex-shrink-0 flex items-center justify-center shadow-xl ${msg.sender === 'user' ? 'bg-primary text-white' : 'bg-gray-800 border border-gray-700 text-accent'}`}>
                                    {msg.sender === 'user' ? <ProfileIcon className="w-5 h-5" /> : <FinanceBuddyIcon className="w-5 h-5" />}
                                </div>
                                <div className={`p-1 rounded-[24px] ${msg.sender === 'user' ? 'bg-primary text-white' : 'bg-gray-900 border border-gray-800 text-gray-300'}`}>
                                    <div className="px-6 py-4 text-sm font-medium">
                                        <div className="whitespace-pre-wrap leading-relaxed">
                                            {msg.text || 'Processing neural pathways...'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Evidence Receipts */}
                            {msg.sender === 'ai' && msg.evidenceIds && msg.evidenceIds.length > 0 && (
                                <div className="mt-4 ml-14 w-full max-w-[90%]">
                                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] mb-3 ml-2">Verified Evidence</p>
                                    <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
                                        {msg.evidenceIds.map(id => {
                                            const receipt = receipts.find(r => r.id === id);
                                            return receipt ? <ReceiptEvidence key={id} receipt={receipt} currency={userSettings.currency} /> : null;
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start items-center gap-3">
                            <div className="w-10 h-10 rounded-[16px] animate-pulse bg-gray-800" />
                            <span className="text-[10px] font-black uppercase text-gray-600 tracking-widest animate-pulse">
                                Neural Processing...
                            </span>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-dark-card border-t border-gray-800">
                    <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="relative flex items-center gap-4">
                        <input
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            placeholder="Ask a question about your finances..."
                            className="w-full bg-gray-900 border-2 border-gray-800 text-white rounded-[24px] py-5 px-8 pr-32 focus:outline-none focus:border-primary transition-all font-bold text-sm"
                            disabled={isLoading}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                            <button type="submit" disabled={isLoading || !userInput.trim()} className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 bg-primary shadow-neon-primary">
                                <SendIcon className="w-6 h-6 text-white" />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }` }} />
        </div>
    );
};

export default FinanceBuddy;
