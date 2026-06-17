
import React from 'react';
import { 
  BoltIcon, 
  DashboardIcon, 
  ReceiptsIcon, 
  ReportsIcon,
  CategoriesIcon,
  FinanceBuddyIcon,
  PlanIcon,
  ProfileIcon,
  LogoutIcon,
  PlusIcon,
  XMarkIcon
} from './Icons';
import type { Page } from '../types';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  isPrivacyMode?: boolean;
  onTogglePrivacy?: () => void;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  variant?: 'danger' | 'accent' | 'default';
}> = ({ icon, label, isActive, onClick, variant = 'default' }) => {
  const baseClasses = 'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer group';
  const activeClasses = 'bg-primary text-white font-semibold shadow-lg shadow-primary/30';
  
  let inactiveClasses = 'text-gray-400 hover:bg-gray-800/80 hover:text-white';
  if (variant === 'danger') {
    inactiveClasses = 'text-red-500/70 hover:bg-red-500/10 hover:text-red-500';
  } else if (variant === 'accent') {
    inactiveClasses = 'text-accent/70 hover:bg-accent/10 hover:text-accent';
  }
  
  return (
    <li onClick={onClick} className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}>
      <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
        {icon}
      </span>
      <span className="text-sm tracking-wide">{label}</span>
    </li>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ 
    currentPage, 
    onNavigate, 
    isPrivacyMode = false, 
    onTogglePrivacy,
    onLogout,
    isOpen,
    onClose
}) => {
    const navItems: { page: Page, label: string, icon: React.ReactNode }[] = [
        { page: 'dashboard', label: 'Dashboard', icon: <DashboardIcon className="w-6 h-6" /> },
        { page: 'plan', label: 'The Plan', icon: <PlanIcon className="w-6 h-6" /> },
        { page: 'receipts', label: 'History', icon: <ReceiptsIcon className="w-6 h-6" /> },
        { page: 'reports', label: 'Reports', icon: <ReportsIcon className="w-6 h-6" /> },
        { page: 'categories', label: 'Categories', icon: <CategoriesIcon className="w-6 h-6" /> },
        { page: 'financeBuddy', label: 'AI Buddy', icon: <FinanceBuddyIcon className="w-6 h-6" /> },
    ];

    const sidebarClasses = `
        fixed inset-y-0 left-0 z-[100] w-72 bg-dark-card border-r border-gray-800 flex flex-col transition-transform duration-300 ease-in-out
        sm:relative sm:translate-x-0 ${isOpen ? 'translate-x-0 shadow-2xl shadow-black' : '-translate-x-full'}
    `;

    const handleItemClick = (page: Page) => {
        onNavigate(page);
        if (onClose) onClose();
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] sm:hidden animate-in fade-in duration-300" 
                    onClick={onClose}
                />
            )}

            <aside className={sidebarClasses}>
                {/* Header Section */}
                <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                            <BoltIcon className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-xl font-black text-white tracking-tighter uppercase italic">Finance Buddy</h1>
                    </div>
                    <button onClick={onClose} className="sm:hidden text-gray-500 hover:text-white p-1">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Primary Action */}
                <div className="px-6 mb-4">
                    <button 
                        onClick={() => handleItemClick('addReceipt')}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all duration-300 text-white ${currentPage === 'addReceipt' ? 'bg-accent shadow-neon-accent' : 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/30'}`}
                    >
                        <PlusIcon className="w-5 h-5" />
                        Add Receipt
                    </button>
                </div>

                {/* Quick Toggle Area */}
                <div className="px-6 mb-6">
                    <div 
                        onClick={onTogglePrivacy}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all duration-300 ${
                            isPrivacyMode 
                            ? 'bg-accent/5 border-accent text-accent shadow-neon-accent' 
                            : 'bg-gray-800/30 border-gray-700 text-gray-500 hover:border-gray-600'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isPrivacyMode ? 'bg-accent animate-pulse' : 'bg-gray-700'}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{isPrivacyMode ? 'Private Mode' : 'Show Details'}</span>
                        </div>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${isPrivacyMode ? 'bg-accent' : 'bg-gray-700'}`}>
                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm ${isPrivacyMode ? 'left-[18px]' : 'left-[2px]'}`} />
                        </div>
                    </div>
                </div>

                {/* Scrollable Navigation Area */}
                <nav className="flex-grow overflow-y-auto px-4 custom-scrollbar">
                    <ul className="space-y-1 pb-4">
                        <li className="px-4 py-2 text-[10px] font-black text-gray-600 uppercase tracking-widest">Main Menu</li>
                        {navItems.map(item => (
                            <NavItem
                                key={item.page}
                                icon={item.icon}
                                label={item.label}
                                isActive={currentPage === item.page}
                                onClick={() => handleItemClick(item.page)}
                            />
                        ))}
                    </ul>
                </nav>

                {/* Always Visible Sticky Footer */}
                <div className="mt-auto p-4 border-t border-gray-800 bg-dark-card/50 backdrop-blur-sm">
                    <ul className="space-y-1">
                        <li className="px-4 py-2 text-[10px] font-black text-gray-600 uppercase tracking-widest">Settings</li>
                        <NavItem
                            icon={<ProfileIcon className="w-6 h-6" />}
                            label="Profile & PIN"
                            isActive={currentPage === 'profile'}
                            onClick={() => handleItemClick('profile')}
                            variant="accent"
                        />
                        <NavItem
                            icon={<LogoutIcon className="w-6 h-6" />}
                            label="Sign Out"
                            isActive={false}
                            onClick={onLogout}
                            variant="danger"
                        />
                    </ul>
                </div>
            </aside>

            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #1F2937; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #374151; }
            `}} />
        </>
    );
};
