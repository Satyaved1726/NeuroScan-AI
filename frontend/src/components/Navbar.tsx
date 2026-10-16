import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useProfilePhoto } from '../hooks/useProfilePhoto';
import { useLanguage } from '../hooks/useLanguage';
import { useDarkMode } from '../hooks/useDarkMode';
import { useMRIWorkflow } from '../hooks/useMRIWorkflow';
import ProfileAvatar from './ProfileAvatar';
import NotificationCenter from './NotificationCenter';
import MaterialIcon from './MaterialIcon';
import { useNotifications } from '../contexts/NotificationContext';
import type { Language } from '../contexts/LanguageContext';
import type { ThemeMode } from '../contexts/DarkModeContext';

interface NavbarProps {
  toggleSidebar: () => void;
  isSidebarCollapsed?: boolean;
}

export default function Navbar({ toggleSidebar, isSidebarCollapsed = true }: NavbarProps) {
  const { user, logout } = useAuth();
  const { photoUrl } = useProfilePhoto();
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme, toggleDarkMode, isDark } = useDarkMode();
  const { state: workflowState } = useMRIWorkflow();
  const { unreadCount } = useNotifications();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const query = searchQuery.trim();
    if (query.length > 20 || query.includes('-')) {
      navigate(`/results/${query}`);
    } else {
      navigate(`/history?search=${encodeURIComponent(query)}`);
    }
  };

  // Get active current patient info if any
  const currentPatientName = workflowState.prediction?.patientName || workflowState.file?.name;
  const currentPatientId = workflowState.prediction?.patientId || 'NSA-TEMP';
  const currentScanId = workflowState.prediction?.scanId || workflowState.file?.scanId;

  return (
    <header className={`fixed top-0 right-0 z-30 bg-white dark:bg-[#101E36] border-b border-clinical-border dark:border-slate-700 h-16 shadow-sm font-sans text-clinical-ink dark:text-white transition-all duration-300 left-0 lg:left-20 ${
      isSidebarCollapsed ? '' : 'lg:left-64'
    }`}>
      <div className="px-4 lg:px-6 h-full flex items-center justify-between gap-4">

        {/* Left Section: Menu Toggle, Brand Logo */}
        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-clinical-textSecondary block lg:hidden"
            aria-label="Toggle Navigation"
          >
            <MaterialIcon name="menu" className="text-[20px]" />
          </button>

          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => navigate('/dashboard')}>
            <div className="flex h-8.5 w-8.5 items-center justify-center rounded-[10px] bg-clinical-primary text-white">
              <MaterialIcon name="neurology" className="text-[20px]" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-clinical-ink dark:text-white hidden sm:inline">
              NEUROSCAN <span className="text-clinical-primary font-bold">AI</span>
            </span>
          </div>
        </div>

        {/* Current Patient telemetry banner */}
        {currentPatientName && (
          <div className="hidden lg:flex items-center gap-2 bg-[#EEF5FF] dark:bg-[#0C111C] border border-clinical-border dark:border-slate-700 px-3.5 py-1.5 rounded-full text-xs font-semibold select-none">
            <span className="h-2 w-2 rounded-full bg-clinical-primary animate-pulse" />
            <span className="text-clinical-textSecondary truncate max-w-xs">
              {t('navbar_active_patient', 'Active PACS Scan')}: <strong className="text-clinical-ink dark:text-white font-bold">{currentPatientName}</strong> {currentScanId && `(ID: ${currentScanId})`}
            </span>
          </div>
        )}

        {/* Center: Global Search (Patient/Scan ID) */}
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xs xl:max-w-md hidden md:block">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-clinical-textSecondary">
              <MaterialIcon name="search" className="text-[18px]" />
            </span>
            <input
              type="text"
              placeholder={t('navbar_search', 'Search patient or scan ID...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-semibold pl-9 pr-4 py-2 border border-clinical-border dark:border-slate-700 rounded-clinical bg-slate-50 dark:bg-slate-850 text-clinical-ink dark:text-white placeholder-clinical-textSecondary focus:outline-none focus:border-clinical-primary transition-colors"
            />
          </div>
        </form>

        {/* Right Section: Actions, Theme, Language, User Dropdowns */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">

          {/* Quick New MRI Scan button */}
          <button
            onClick={() => navigate('/analysis')}
            className="px-3 py-1.5 rounded-clinical bg-clinical-primary text-white text-xs font-extrabold flex items-center gap-1 hover:opacity-90 transition active:scale-95 cursor-pointer shadow-sm"
            title="Start New MRI Scan"
          >
            <MaterialIcon name="add" className="text-[16px] font-bold" />
            <span className="hidden sm:inline">New Scan</span>
          </button>

          {/* Theme Toggle Button (Light / Dark Mode) */}
          <button
            onClick={toggleDarkMode}
            className="flex items-center justify-center h-8 w-8 rounded-clinical bg-[#EEF5FF] dark:bg-slate-800 border border-clinical-border dark:border-slate-700 text-clinical-textSecondary hover:text-clinical-ink dark:hover:text-white transition-colors cursor-pointer"
            title={isDark ? t('navbar_theme_light', 'Switch to Light Mode') : t('navbar_theme_dark', 'Switch to Dark Mode')}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <MaterialIcon
              name={isDark ? 'light_mode' : 'dark_mode'}
              className={`text-[18px] ${isDark ? 'text-amber-400' : 'text-slate-700'}`}
            />
          </button>

          {/* Language Dropdown Selector */}
          <div className="relative flex items-center gap-1 bg-[#EEF5FF] dark:bg-slate-800 px-2.5 py-1.5 rounded-clinical border border-clinical-border dark:border-slate-700">
            <MaterialIcon name="language" className="text-[16px] text-clinical-textSecondary" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-transparent text-xs font-bold text-clinical-textSecondary hover:text-clinical-ink outline-none cursor-pointer border-none p-0"
              aria-label="Select System Language"
            >
              <option value="en" className="text-clinical-ink dark:bg-[#1E293B]">English</option>
              <option value="te" className="text-clinical-ink dark:bg-[#1E293B]">తెలుగు</option>
              <option value="hi" className="text-clinical-ink dark:bg-[#1E293B]">हिन्दी</option>
            </select>
          </div>

          {/* Notification Center */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-full transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 text-clinical-textSecondary dark:text-slate-350"
              aria-label="Show Alerts"
            >
              <MaterialIcon name="notifications" className="text-[20px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#DC2626] text-[8px] font-extrabold text-white border border-white dark:border-[#101E36]">
                  {unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <NotificationCenter onClose={() => setShowNotifications(false)} />
            )}
          </div>

          {/* Vertical divider */}
          <div className="h-5 w-px bg-clinical-border dark:bg-slate-700 hidden sm:block" />

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <ProfileAvatar src={photoUrl} name={user?.name} sizeClassName="h-7 w-7" />
              <span className="hidden sm:inline text-xs font-semibold text-clinical-textPrimary dark:text-slate-200">
                {user?.name}
              </span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-[10px] border border-clinical-border dark:border-slate-700 bg-white dark:bg-[#1E293B] p-2 shadow-lg z-50 text-left">
                <div className="px-3 py-2.5 border-b border-clinical-border dark:border-slate-700 text-xs text-clinical-textSecondary">
                  <span className="font-bold text-clinical-textPrimary dark:text-slate-200 block truncate">{user?.name}</span>
                  <span className="block truncate mt-0.5">{user?.email}</span>
                </div>

                <button
                  onClick={() => { setShowUserMenu(false); navigate('/profile'); }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-clinical-textPrimary dark:text-slate-300 flex items-center gap-2 mt-1.5"
                >
                  <MaterialIcon name="settings" className="text-[16px]" /> {t('navbar_account_settings', 'Account Settings')}
                </button>

                <button
                  onClick={() => { setShowUserMenu(false); handleLogout(); }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-semibold text-clinical-status-critical flex items-center gap-2 mt-1"
                >
                  <MaterialIcon name="logout" className="text-[16px]" /> {t('navbar_sign_out', 'Sign Out')}
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  );
}
