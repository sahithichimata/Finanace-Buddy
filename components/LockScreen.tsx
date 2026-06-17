
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BoltIcon, TrashIcon, XMarkIcon } from './Icons';
import { hashPin } from '../utils/security';

interface LockScreenProps {
  savedPin: string; // Salted Hash
  onUnlock: () => void;
  onReset: () => void;
  savedName?: string;
  isLoginMode?: boolean; // If true, requires name entry
  onBack?: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ 
    savedPin, 
    onUnlock, 
    onReset, 
    savedName, 
    isLoginMode = false,
    onBack
}) => {
  const [pin, setPin] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [error, setError] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleKeyPress = (num: string) => {
    if (isVerifying) return;
    if (isLoginMode && !nameInput.trim()) {
        setError(true);
        setTimeout(() => setError(false), 500);
        return;
    }

    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        setIsVerifying(true);
        setTimeout(() => {
            const hashedInput = hashPin(newPin);
            const pinMatch = hashedInput === savedPin;
            const nameMatch = !isLoginMode || (nameInput.trim().toLowerCase() === savedName?.toLowerCase());

            if (pinMatch && nameMatch) {
              onUnlock();
            } else {
              setError(true);
              setIsVerifying(false);
              setTimeout(() => {
                setPin('');
                setError(false);
              }, 600);
            }
        }, 400);
      }
    }
  };

  const handleDelete = () => {
    if (isVerifying) return;
    setPin(pin.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#020408] flex flex-col items-center justify-center p-6 font-sans overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 blur-[120px] rounded-full pointer-events-none" />

      <AnimatePresence mode="wait">
        {showResetConfirm ? (
          <motion.div 
            key="reset-confirm"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-sm bg-dark-card/40 backdrop-blur-3xl border border-white/5 rounded-[48px] p-10 shadow-2xl relative z-10"
          >
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <TrashIcon className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-black text-white mb-3 text-center italic uppercase tracking-tighter">Reset Vault</h2>
            <p className="text-gray-400 text-sm mb-8 text-center leading-relaxed">
                Forgotten your PIN? Resetting will permanently erase all local data. This action is irreversible.
            </p>
            <div className="space-y-3">
                <button 
                    onClick={onReset} 
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] shadow-lg shadow-red-600/20 transition-all active:scale-95"
                >
                    Confirm Wipe
                </button>
                <button 
                    onClick={() => setShowResetConfirm(false)} 
                    className="w-full text-gray-500 font-black py-3 hover:text-white transition-colors uppercase tracking-widest text-[10px]"
                >
                    Cancel
                </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="lock-main"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`w-full max-w-md relative z-10`}
          >
            {onBack && (
                <button 
                    onClick={onBack} 
                    className="absolute -top-12 left-0 text-gray-500 hover:text-white transition-colors flex items-center gap-2 group"
                >
                    <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                        <XMarkIcon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
                </button>
            )}

            <div className={`bg-dark-card/40 backdrop-blur-3xl border border-white/5 rounded-[56px] p-10 shadow-2xl transition-all duration-500 ${error ? 'animate-shake ring-2 ring-red-500/50' : 'ring-1 ring-white/5'}`}>
                <div className="flex flex-col items-center mb-10">
                    <motion.div 
                        whileHover={{ scale: 1.05, rotate: 5 }}
                        className="w-20 h-20 bg-gradient-to-br from-primary via-primary/80 to-accent rounded-[28px] flex items-center justify-center shadow-2xl shadow-primary/30 mb-8 relative group"
                    >
                        <div className="absolute inset-0 bg-white/20 rounded-[28px] opacity-0 group-hover:opacity-100 transition-opacity" />
                        <BoltIcon className="w-12 h-12 text-white drop-shadow-lg" />
                    </motion.div>
                    <h1 className="text-4xl font-black text-white tracking-tighter italic uppercase">Security</h1>
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mt-3">
                        {isLoginMode ? 'Identity Verification' : 'Access Restricted'}
                    </p>
                </div>

                {isLoginMode && (
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="mb-8 space-y-3"
                    >
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.4em] ml-2">Authorized Name</label>
                        <div className="relative">
                            <input 
                                type="text"
                                autoFocus
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                placeholder="Enter your name..."
                                className="w-full bg-black/40 border border-white/5 text-white rounded-3xl p-5 text-lg focus:border-primary/50 outline-none transition-all placeholder:text-gray-700 font-medium"
                            />
                            {nameInput && (
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(108,99,255,0.5)]" />
                            )}
                        </div>
                    </motion.div>
                )}

                <div className="flex justify-center gap-5 mb-12">
                    {[0, 1, 2, 3].map((i) => (
                        <motion.div
                            key={i}
                            animate={{ 
                                scale: pin.length > i ? 1.2 : 1,
                                backgroundColor: pin.length > i ? '#6C63FF' : 'rgba(255,255,255,0.05)'
                            }}
                            className={`w-4 h-4 rounded-full transition-all duration-300 ${
                                pin.length > i 
                                    ? 'shadow-[0_0_20px_rgba(108,99,255,0.6)]' 
                                    : 'border border-white/5'
                            }`}
                        />
                    ))}
                </div>

                <div className="grid grid-cols-3 gap-6">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                        <button
                            key={num}
                            disabled={isVerifying}
                            onClick={() => handleKeyPress(num)}
                            className="h-20 rounded-[32px] bg-white/5 hover:bg-white/10 border border-white/5 text-2xl font-black text-white transition-all active:scale-90 flex items-center justify-center group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="relative z-10">{num}</span>
                        </button>
                    ))}
                    <div />
                    <button
                        disabled={isVerifying}
                        onClick={() => handleKeyPress('0')}
                        className="h-20 rounded-[32px] bg-white/5 hover:bg-white/10 border border-white/5 text-2xl font-black text-white transition-all active:scale-90 flex items-center justify-center group relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="relative z-10">0</span>
                    </button>
                    <button
                        disabled={isVerifying}
                        onClick={handleDelete}
                        className="h-20 rounded-[32px] flex items-center justify-center text-gray-600 hover:text-white transition-all active:scale-90 group"
                    >
                        <div className="p-4 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75 14.25 12m0 0 2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92-6.37-6.18a1.5 1.5 0 0 1 0-2.18l6.37-6.18a1.5 1.5 0 0 1 1.06-.44H20.25a1.5 1.5 0 0 1 1.5 1.5v11.25a1.5 1.5 0 0 1-1.5 1.5H9.69a1.5 1.5 0 0 1-1.06-.44Z" />
                            </svg>
                        </div>
                    </button>
                </div>

                <button 
                    onClick={() => setShowResetConfirm(true)}
                    className="w-full mt-10 text-[9px] font-black uppercase text-gray-600 hover:text-red-500 transition-colors tracking-[0.4em]"
                >
                    Forgot PIN? Reset Vault
                </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Footer Logo */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="fixed bottom-12 flex flex-col items-center gap-3"
      >
           <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                <BoltIcon className="w-5 h-5 text-gray-700" />
           </div>
           <span className="text-[9px] font-black uppercase text-gray-700 tracking-[0.6em] ml-1">Finance Buddy</span>
      </motion.div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
        .animate-shake { animation: shake 0.2s cubic-bezier(.36,.07,.19,.97) 3; }
        @keyframes shine { from { transform: translateX(-100%) skewX(-12deg); } to { transform: translateX(200%) skewX(-12deg); } }
        .animate-shine { animation: shine 3s infinite; }
      `}} />
    </div>
  );
};
