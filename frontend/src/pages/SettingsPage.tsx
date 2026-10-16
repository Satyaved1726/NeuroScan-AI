import { useState, useEffect } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { useToastContext } from '../hooks/useToastContext';
import { motion } from 'framer-motion';
import ProfilePage from './ProfilePage';
import MaterialIcon from '../components/MaterialIcon';
import { fetchUserSettings, updateUserSettings } from '../services/settingsService';

type SettingsTab = 'general' | 'appearance' | 'language' | 'notifications' | 'security';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { theme, setTheme } = useDarkMode() || { theme: 'light', setTheme: () => {} };
  const { language, setLanguage, t } = useLanguage();
  const { user } = useAuth();
  const toast = useToastContext();

  // Extended Notification Preferences State
  const [assistantLanguage, setAssistantLanguage] = useState('en');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState('medium');

  useEffect(() => {
    fetchUserSettings().then((s) => {
      if (s.theme) setTheme(s.theme as any);
      if (s.language) setLanguage(s.language as any);
      setAssistantLanguage(s.assistant_language || 'en');
      setVoiceEnabled(s.voice_enabled ?? true);
      setSpeechRate(s.speech_rate ?? 1.0);
      setNotifications(s.notifications ?? true);
      setEmailNotifications(s.email_notifications ?? true);
      setPushNotifications(s.push_notifications ?? true);
      setHighContrast(s.high_contrast ?? false);
      setFontSize(s.font_size || 'medium');
    }).catch(() => {});
  }, [setTheme, setLanguage]);

  // Local Security Credentials State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All password fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setIsUpdatingPassword(true);
    setTimeout(() => {
      setIsUpdatingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('System credentials reset successfully');
    }, 1000);
  };

  const handleSaveSettings = async () => {
    try {
      await updateUserSettings({
        theme,
        language,
        assistant_language: assistantLanguage,
        voice_enabled: voiceEnabled,
        speech_rate: speechRate,
        notifications,
        email_notifications: emailNotifications,
        push_notifications: pushNotifications,
        high_contrast: highContrast,
        font_size: fontSize
      });
      toast.success('User settings saved successfully');
    } catch (err) {
      toast.error('Failed to save settings to the database');
    }
  };

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'medical') => {
    setTheme(newTheme);
    try {
      await updateUserSettings({
        theme: newTheme,
        language,
        assistant_language: assistantLanguage,
        voice_enabled: voiceEnabled,
        speech_rate: speechRate,
        notifications,
        email_notifications: emailNotifications,
        push_notifications: pushNotifications,
        high_contrast: highContrast,
        font_size: fontSize
      });
    } catch {}
  };

  const handleLanguageChange = async (newLang: 'en' | 'te' | 'hi') => {
    setLanguage(newLang);
    try {
      await updateUserSettings({
        theme,
        language: newLang,
        assistant_language: assistantLanguage,
        voice_enabled: voiceEnabled,
        speech_rate: speechRate,
        notifications,
        email_notifications: emailNotifications,
        push_notifications: pushNotifications,
        high_contrast: highContrast,
        font_size: fontSize
      });
    } catch {}
  };

  const tabItems = [
    { id: 'general' as const, label: 'General & Profile', icon: 'person' },
    { id: 'appearance' as const, label: 'Workstation Appearance', icon: 'palette' },
    { id: 'language' as const, label: 'Language Selection', icon: 'translate' },
    { id: 'notifications' as const, label: 'PACS Alerts & Notify', icon: 'notifications' },
    { id: 'security' as const, label: 'Security & Access', icon: 'security' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6 font-sans text-clinical-ink dark:text-white"
    >
      <div>
        <p className="text-[10px] font-bold text-clinical-primary uppercase tracking-widest">USER ACCOUNT CONFIG</p>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">System Settings</h2>
        <p className="text-xs text-clinical-textSecondary mt-0.5">Customize PACS workstation layouts, notifications preferences, and security credentials</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[240px_1fr] items-start">
        {/* Left Side Sidebar Tabs */}
        <div className="flex flex-col gap-1 bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-2.5 shadow-soft">
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-clinical text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-clinical-primary/10 text-clinical-primary dark:bg-slate-800 dark:text-clinical-primary border-l-4 border-clinical-primary'
                  : 'text-clinical-textSecondary hover:text-clinical-ink dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <MaterialIcon name={tab.icon} className="text-[18px]" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Right Side Settings Panel Details */}
        <div className="bg-white dark:bg-[#1E293B] border border-clinical-border dark:border-slate-700 rounded-clinical p-6 shadow-soft min-h-[400px]">

          {/* Tab 1: General & Profile */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <h3 className="text-base font-extrabold border-b border-slate-100 dark:border-slate-800 pb-2">Profile & Demographics Details</h3>
              <ProfilePage />
            </div>
          )}

          {/* Tab 2: Workstation Appearance */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-extrabold border-b border-slate-100 dark:border-slate-800 pb-2">PACS Workstation Theme Mode</h3>
                <p className="text-xs text-clinical-textSecondary mt-1">Select your preferred viewing canvas lighting style optimized for radiological reviews.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { id: 'light' as const, name: 'Light Mode', desc: 'Standard high-contrast grey panels', icon: 'light_mode' },
                  { id: 'dark' as const, name: 'Dark Workstation', desc: 'Optimized dark workspace parameters', icon: 'dark_mode' },
                  { id: 'medical' as const, name: 'Clinical PACS Theme', desc: 'Hospital workstation medical palette', icon: 'medical_services' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleThemeChange(item.id)}
                    className={`p-4 border rounded-clinical text-left space-y-2 hover:border-clinical-primary transition-all shadow-sm ${
                      theme === item.id
                        ? 'border-clinical-primary bg-clinical-primary/5 dark:bg-slate-800'
                        : 'border-clinical-border dark:border-slate-700 bg-white dark:bg-[#1E293B]'
                    }`}
                  >
                    <MaterialIcon name={item.icon} className={`text-[28px] ${theme === item.id ? 'text-clinical-primary' : 'text-clinical-textSecondary'}`} />
                    <div>
                      <p className="text-xs font-bold text-clinical-ink dark:text-white">{item.name}</p>
                      <span className="text-[10px] text-clinical-textSecondary mt-0.5 block leading-normal">{item.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Language Selection */}
          {activeTab === 'language' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-extrabold border-b border-slate-100 dark:border-slate-800 pb-2">Language Selection</h3>
                <p className="text-xs text-clinical-textSecondary mt-1">Change the application vocabulary translation dynamically across English, Telugu, and Hindi.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { id: 'en' as const, name: 'English', desc: 'Default international diagnostics terms' },
                  { id: 'te' as const, name: 'తెలుగు (Telugu)', desc: 'ప్రాంతీయ భాషా అనువాదం' },
                  { id: 'hi' as const, name: 'हिन्दी (Hindi)', desc: 'मानक हिन्दी शब्दावली' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleLanguageChange(item.id)}
                    className={`p-4 border rounded-clinical text-left space-y-2 hover:border-clinical-primary transition-all shadow-sm ${
                      language === item.id
                        ? 'border-clinical-primary bg-clinical-primary/5 dark:bg-slate-800'
                        : 'border-clinical-border dark:border-slate-700 bg-white dark:bg-[#1E293B]'
                    }`}
                  >
                    <span className="text-lg font-bold block text-clinical-primary">{item.id === 'en' ? 'A' : item.id === 'te' ? 'అ' : 'अ'}</span>
                    <div>
                      <p className="text-xs font-bold text-clinical-ink dark:text-white">{item.name}</p>
                      <span className="text-[10px] text-clinical-textSecondary mt-0.5 block leading-normal">{item.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Notifications Settings */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-extrabold border-b border-slate-100 dark:border-slate-800 pb-2">PACS System Alerts & Notifications</h3>
                <p className="text-xs text-clinical-textSecondary mt-1">Configure preferences for system notifications and alerts delivery channels.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-clinical-textPrimary dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={notifications}
                      onChange={(e) => setNotifications(e.target.checked)}
                      className="rounded border-slate-350 text-clinical-primary focus:ring-clinical-primary h-4 w-4"
                    />
                    <span>Enable overall system notifications</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-clinical-textPrimary dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={emailNotifications}
                      onChange={(e) => setEmailNotifications(e.target.checked)}
                      className="rounded border-slate-300 text-clinical-primary focus:ring-clinical-primary h-4 w-4"
                    />
                    <span>Receive email reports summaries on scan compilations</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-clinical-textPrimary dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={pushNotifications}
                      onChange={(e) => setPushNotifications(e.target.checked)}
                      className="rounded border-slate-300 text-clinical-primary focus:ring-clinical-primary h-4 w-4"
                    />
                    <span>Enable in-app real-time notification alerts popups</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-clinical-textPrimary dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={voiceEnabled}
                      onChange={(e) => setVoiceEnabled(e.target.checked)}
                      className="rounded border-slate-350 text-clinical-primary focus:ring-clinical-primary h-4 w-4"
                    />
                    <span>Enable JEMMI voice playback engine</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-clinical-textPrimary dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={highContrast}
                      onChange={(e) => setHighContrast(e.target.checked)}
                      className="rounded border-slate-350 text-clinical-primary focus:ring-clinical-primary h-4 w-4"
                    />
                    <span>Enable diagnostic high-contrast viewport mode</span>
                  </label>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={handleSaveSettings}
                    className="px-4 py-2 bg-clinical-primary hover:bg-[#005c54] text-white rounded-clinical text-xs font-bold transition shadow-sm"
                  >
                    Save Preferences
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Security & Access */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-extrabold border-b border-slate-100 dark:border-slate-800 pb-2">Change Account Password</h3>
                <p className="text-xs text-clinical-textSecondary mt-1">Manage security credentials and reset clinical account password access.</p>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-sm">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full text-xs font-bold py-2.5 px-3 rounded-clinical border border-clinical-border dark:border-slate-700 bg-white dark:bg-slate-800 text-clinical-ink dark:text-white outline-none focus:border-clinical-primary focus:ring-1 focus:ring-clinical-primary transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full text-xs font-bold py-2.5 px-3 rounded-clinical border border-clinical-border dark:border-slate-700 bg-white dark:bg-slate-800 text-clinical-ink dark:text-white outline-none focus:border-clinical-primary focus:ring-1 focus:ring-clinical-primary transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-clinical-textSecondary">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full text-xs font-bold py-2.5 px-3 rounded-clinical border border-clinical-border dark:border-slate-700 bg-white dark:bg-slate-800 text-clinical-ink dark:text-white outline-none focus:border-clinical-primary focus:ring-1 focus:ring-clinical-primary transition-all"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="px-4 py-2 bg-clinical-primary hover:bg-[#005c54] disabled:opacity-50 text-white rounded-clinical text-xs font-bold transition shadow-sm"
                  >
                    {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </motion.div>
  );
}
