
import React from 'react';
import { BoltIcon, ProfileIcon, PlusIcon } from './Icons';

interface AuthGateProps {
    onSelect: (mode: 'new' | 'existing') => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onSelect }) => {
    return (
        <div className="fixed inset-0 z-[120] bg-dark-bg flex items-center justify-center p-6 animate-in fade-in duration-700">
            {/* Background Glows */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 blur-[120px] rounded-full -z-10" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 blur-[120px] rounded-full -z-10" />

            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* New User Card */}
                <button 
                    onClick={() => onSelect('new')}
                    className="group relative bg-dark-card border border-gray-800 rounded-[48px] p-12 text-center transition-all duration-500 hover:border-primary hover:scale-[1.02] hover:shadow-2xl hover:shadow-primary/20"
                >
                    <div className="mx-auto w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mb-8 group-hover:bg-primary group-hover:scale-110 transition-all duration-500">
                        <PlusIcon className="w-12 h-12 text-primary group-hover:text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">New Member</h2>
                    <p className="text-gray-500 text-lg leading-relaxed">
                        Start fresh with a new local account and set up your spending plan.
                    </p>
                    <div className="mt-8 inline-flex items-center gap-2 text-primary font-black uppercase tracking-widest text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                        Get Started
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                        </svg>
                    </div>
                </button>

                {/* Existing User Card */}
                <button 
                    onClick={() => onSelect('existing')}
                    className="group relative bg-dark-card border border-gray-800 rounded-[48px] p-12 text-center transition-all duration-500 hover:border-accent hover:scale-[1.02] hover:shadow-2xl hover:shadow-accent/20"
                >
                    <div className="mx-auto w-24 h-24 bg-accent/10 rounded-3xl flex items-center justify-center mb-8 group-hover:bg-accent group-hover:scale-110 transition-all duration-500">
                        <ProfileIcon className="w-12 h-12 text-accent group-hover:text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Existing User</h2>
                    <p className="text-gray-500 text-lg leading-relaxed">
                        Already have an account? Sign in with your name and PIN to access your data.
                    </p>
                    <div className="mt-8 inline-flex items-center gap-2 text-accent font-black uppercase tracking-widest text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                        Unlock Account
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                        </svg>
                    </div>
                </button>
            </div>

            {/* Logo Footer */}
            <div className="fixed bottom-12 flex flex-col items-center gap-2">
                 <BoltIcon className="w-6 h-6 text-gray-700" />
                 <span className="text-[10px] font-black uppercase text-gray-700 tracking-[0.4em]">Finance Buddy</span>
            </div>
        </div>
    );
};
