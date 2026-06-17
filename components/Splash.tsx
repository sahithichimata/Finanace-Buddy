import React, { useEffect, useState } from 'react';
import { BoltIcon } from './Icons';

export const Splash: React.FC = () => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(false), 2500);
        return () => clearTimeout(timer);
    }, []);

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-dark-bg flex flex-col items-center justify-center animate-out fade-out duration-700 fill-mode-forwards">
            <div className="relative">
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-primary/20 blur-[100px] animate-pulse rounded-full" />
                
                <div className="relative bg-dark-card p-8 rounded-[40px] border border-gray-800 shadow-2xl flex flex-col items-center scale-up-center animate-in zoom-in-75 duration-500">
                    <div className="w-24 h-24 bg-gradient-to-tr from-primary to-accent rounded-3xl flex items-center justify-center shadow-neon-primary mb-6">
                        <BoltIcon className="w-14 h-14 text-white animate-bounce" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">
                        Finance Buddy
                    </h1>
                </div>
            </div>
            <p className="fixed bottom-12 text-gray-600 text-[10px] font-black uppercase tracking-[0.4em]">
                Secure & Simple
            </p>
        </div>
    );
};