
import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { LockScreen } from './components/LockScreen';
import { Splash } from './components/Splash';
import { Onboarding } from './components/Onboarding';
import { AuthGate } from './components/AuthGate';
import { 
  DashboardIcon, 
  ReceiptsIcon, 
  PlusIcon, 
  FinanceBuddyIcon, 
  ProfileIcon,
  MenuIcon,
  BoltIcon
} from './components/Icons';
import Dashboard from './pages/Dashboard';
import AddReceipt from './pages/AddReceipt';
import Receipts from './pages/Receipts';
import Reports from './pages/Reports';
import Categories from './pages/Categories';
import FinanceBuddy from './pages/FinanceBuddy';
import Plan from './pages/Plan';
import Profile from './pages/Profile';
import { learnFromCorrection } from './services/mlService';
import type { ReceiptData, Category, Page, UserSettings } from './types';

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [authStep, setAuthStep] = useState<'splash' | 'choice' | 'onboarding' | 'login' | 'app'>('splash');
  
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Month Selection State shared across pages
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(now.toISOString().substring(0, 7)); // YYYY-MM
  
  const [userSettings, setUserSettings] = useState<UserSettings>({
    userName: '',
    budget: 0,
    currency: 'INR',
    income: 0,
    savings: 0,
    fixedBills: [],
    isPrivacyMode: false,
    pinCode: undefined,
    autoLockMinutes: 10,
    isOnboarded: false,
    savingsGoal: 0,
    isBufferEnabled: false,
    bufferAmount: 0,
  });

  const inactivityTimerRef = useRef<any>(null);

  const lockVault = () => {
    if (userSettings.pinCode && authStep === 'app') {
      setIsLocked(true);
    }
  };

  const handleLogout = () => {
    setAuthStep('choice');
    setIsLocked(false);
    setIsSidebarOpen(false);
    setCurrentPage('dashboard');
  };

  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (userSettings.pinCode && userSettings.autoLockMinutes && userSettings.autoLockMinutes > 0) {
      inactivityTimerRef.current = setTimeout(lockVault, userSettings.autoLockMinutes * 60 * 1000);
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) lockVault();
    };

    window.addEventListener('mousemove', resetInactivityTimer);
    window.addEventListener('keydown', resetInactivityTimer);
    window.addEventListener('touchstart', resetInactivityTimer);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('mousemove', resetInactivityTimer);
      window.removeEventListener('keydown', resetInactivityTimer);
      window.removeEventListener('touchstart', resetInactivityTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [userSettings.pinCode, userSettings.autoLockMinutes, authStep]);

  useEffect(() => {
    const initialize = async () => {
      try {
        const storedReceipts = localStorage.getItem('finance-buddy-receipts');
        if (storedReceipts) setReceipts(JSON.parse(storedReceipts));

        const storedCategories = localStorage.getItem('finance-buddy-categories');
        if (storedCategories) {
          setCategories(JSON.parse(storedCategories));
        } else {
          setCategories([
            { id: '1', name: 'Utilities', icon: '💡' },
            { id: '2', name: 'Shopping', icon: '🛍️' },
            { id: '3', name: 'Entertainment', icon: '🎬' },
            { id: '4', name: 'Groceries', icon: '🛒' },
            { id: '5', name: 'Transport', icon: '🚗' },
            { id: '6', name: 'Other', icon: '📦' },
          ]);
        }
        
        const storedSettings = localStorage.getItem('finance-buddy-settings');
        if (storedSettings) {
          const settings = JSON.parse(storedSettings);
          setUserSettings(settings);
        }
      } catch (error) {
        console.error("Initialization failure", error);
      } finally {
        setTimeout(() => {
            setAuthStep('choice');
            setIsInitializing(false);
        }, 2800);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (!isInitializing && authStep === 'app') {
      localStorage.setItem('finance-buddy-receipts', JSON.stringify(receipts));
      localStorage.setItem('finance-buddy-categories', JSON.stringify(categories));
      localStorage.setItem('finance-buddy-settings', JSON.stringify(userSettings));
    }
  }, [receipts, categories, userSettings, isInitializing, authStep]);

  const handleUpdateReceiptCategory = (receiptId: string, newCategory: string) => {
    setReceipts(prev => prev.map(r => {
      if (r.id === receiptId) {
        // Trigger Online Incremental Learning feedback loop
        learnFromCorrection(r.merchantName, r.items, newCategory);
        return { ...r, category: newCategory, isVerified: true };
      }
      return r;
    }));

    // Automatically add category if it doesn't exist
    setCategories(prev => {
      const exists = prev.some(c => c.name.toLowerCase() === newCategory.toLowerCase());
      if (!exists) {
        return [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          name: newCategory,
          icon: '📦'
        }];
      }
      return prev;
    });
  };

  const handleDeleteReceipt = (id: string) => {
    setReceipts(prev => prev.filter(r => r.id !== id));
  };

  const handleWipeData = () => {
    localStorage.clear(); 
    window.location.reload();
  };

  if (isInitializing) return <Splash />;
  if (authStep === 'choice') return <AuthGate onSelect={(mode) => setAuthStep(mode === 'new' ? 'onboarding' : 'login')} />;
  if (authStep === 'onboarding') return <Onboarding onComplete={(s) => { setUserSettings(s); setAuthStep('app'); }} />;
  if (authStep === 'login') {
      return (
          <LockScreen 
            savedPin={userSettings.pinCode || ''}
            savedName={userSettings.userName}
            isLoginMode={true}
            onUnlock={() => setAuthStep('app')}
            onReset={handleWipeData}
            onBack={() => setAuthStep('choice')}
          />
      );
  }

  if (isLocked && userSettings.pinCode) {
    return <LockScreen savedPin={userSettings.pinCode} onUnlock={() => setIsLocked(false)} onReset={handleWipeData} />;
  }

  const renderPage = () => {
    switch(currentPage) {
      case 'dashboard': return <Dashboard receipts={receipts} userSettings={userSettings} onNavigate={setCurrentPage} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />;
      case 'addReceipt': return <AddReceipt receipts={receipts} onReceiptAdded={(r) => {
        const withId = { ...r, id: new Date().toISOString() };
        setReceipts(prev => [...prev, withId]);
        
        // Automatically add category if it doesn't exist
        if (r.category) {
          setCategories(prev => {
            const exists = prev.some(c => c.name.toLowerCase() === r.category.toLowerCase());
            if (!exists) {
              return [...prev, {
                id: Math.random().toString(36).substr(2, 9),
                name: r.category,
                icon: '📦'
              }];
            }
            return prev;
          });
        }

        setCurrentPage('receipts');
      }} categories={categories} userSettings={userSettings} />;
      case 'receipts': return <Receipts receipts={receipts} userSettings={userSettings} categories={categories} onUpdateCategory={handleUpdateReceiptCategory} onDeleteReceipt={handleDeleteReceipt} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />;
      case 'reports': return <Reports receipts={receipts} budget={userSettings.budget} currency={userSettings.currency} isPrivacyMode={userSettings.isPrivacyMode} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />;
      case 'categories': return <Categories categories={categories} setCategories={setCategories} />;
      case 'financeBuddy': return <FinanceBuddy receipts={receipts} userSettings={userSettings} currency={userSettings.currency} categories={categories} />;
      case 'plan': return <Plan userSettings={userSettings} receipts={receipts} />;
      case 'profile': return <Profile userSettings={userSettings} onSave={setUserSettings} onWipeData={handleWipeData} />;
      default: return <Dashboard receipts={receipts} userSettings={userSettings} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />;
    }
  };

  const MobileNav = () => (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 h-20 bg-dark-card/80 backdrop-blur-xl border-t border-gray-800 px-6 flex items-center justify-between z-50 shadow-glass">
      <button onClick={() => setCurrentPage('dashboard')} className={`flex flex-col items-center gap-1 ${currentPage === 'dashboard' ? 'text-primary' : 'text-gray-500'}`}>
        <DashboardIcon className="w-6 h-6" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Dash</span>
      </button>
      <button onClick={() => setCurrentPage('receipts')} className={`flex flex-col items-center gap-1 ${currentPage === 'receipts' ? 'text-primary' : 'text-gray-500'}`}>
        <ReceiptsIcon className="w-6 h-6" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Logs</span>
      </button>
      <div className="w-14" /> {/* Spacer for FAB */}
      <button onClick={() => setCurrentPage('financeBuddy')} className={`flex flex-col items-center gap-1 ${currentPage === 'financeBuddy' ? 'text-primary' : 'text-gray-500'}`}>
        <FinanceBuddyIcon className="w-6 h-6" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Buddy</span>
      </button>
      <button onClick={() => setCurrentPage('profile')} className={`flex flex-col items-center gap-1 ${currentPage === 'profile' ? 'text-primary' : 'text-gray-500'}`}>
        <ProfileIcon className="w-6 h-6" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Vault</span>
      </button>
    </nav>
  );

  const FloatingActionButton = () => (
    <button 
        onClick={() => setCurrentPage('addReceipt')}
        className="sm:hidden fixed bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-primary text-white rounded-[24px] flex items-center justify-center z-[60] shadow-neon-primary transition-transform active:scale-90"
    >
        <PlusIcon className="w-10 h-10" />
    </button>
  );

  return (
    <div className="h-screen bg-dark-bg text-gray-100 font-sans flex flex-col sm:flex-row overflow-hidden">
      {/* Mobile Top Header */}
      <div className="sm:hidden fixed top-0 left-0 right-0 h-16 bg-dark-bg/60 backdrop-blur-xl border-b border-gray-800 flex items-center justify-between px-5 z-[80]">
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors">
          <MenuIcon className="w-7 h-7" />
        </button>
        <div className="flex items-center gap-2">
            <BoltIcon className="w-6 h-6 text-primary" />
            <span className="font-black text-white italic tracking-tighter uppercase text-sm">Finance Buddy</span>
        </div>
        <div className="w-11" /> {/* Spacer for balance */}
      </div>

      <Sidebar 
        currentPage={currentPage} 
        onNavigate={setCurrentPage} 
        isPrivacyMode={userSettings.isPrivacyMode}
        onTogglePrivacy={() => setUserSettings(prev => ({ ...prev, isPrivacyMode: !prev.isPrivacyMode }))}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="flex-1 overflow-y-auto relative pt-16 sm:pt-0 pb-24 sm:pb-0">
        <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full -z-10 pointer-events-none" />
        <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-accent/5 blur-[120px] rounded-full -z-10 pointer-events-none" />
        <div className="min-h-full">
          {renderPage()}
        </div>
      </main>
      
      <MobileNav />
      <FloatingActionButton />
    </div>
  );
};

export default App;
