import { ReactNode, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import MaterialIcon from './MaterialIcon';
import JemmiChatDrawer from './JemmiChatDrawer';
import { fetchUserSettings } from '../services/settingsService';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // Default collapsed on mount to fit mobile and clean layout
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState('medium');
  const [isJemmiOpen, setIsJemmiOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('openChat') === 'true') {
      setIsJemmiOpen(true);
    }
  }, [window.location.search]);

  useEffect(() => {
    const handleApiLoading = (e: Event) => {
      const customEvent = e as CustomEvent<{ isLoading: boolean }>;
      setIsApiLoading(customEvent.detail.isLoading);
    };
    window.addEventListener('neuroscan:api-loading', handleApiLoading);
    return () => {
      window.removeEventListener('neuroscan:api-loading', handleApiLoading);
    };
  }, []);

  useEffect(() => {
    const loadAccessibilitySettings = async () => {
      try {
        const settings = await fetchUserSettings();
        if (settings) {
          setHighContrast(settings.high_contrast);
          setFontSize(settings.font_size);
        }
      } catch {
        // Fall back
      }
    };
    loadAccessibilitySettings();

    // Listen for custom settings update events to sync on the fly
    const handleSettingsUpdate = () => {
      loadAccessibilitySettings();
    };
    window.addEventListener('neuroscan:settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('neuroscan:settings-updated', handleSettingsUpdate);
  }, []);

  const fontSizeClass = fontSize === 'small' ? 'font-size-small' : fontSize === 'large' ? 'font-size-large' : '';
  const contrastClass = highContrast ? 'theme-high-contrast' : '';

  return (
    <div className={`min-h-screen bg-clinical-bgApp dark:bg-[#0F172A] text-clinical-ink dark:text-[#F8FAFC] antialiased font-sans flex relative overflow-x-hidden ${fontSizeClass} ${contrastClass}`}>
      {/* Global API Loading Top Progress Bar */}
      {isApiLoading && (
        <div className="fixed top-0 left-0 right-0 h-1 z-[9999] bg-slate-100 dark:bg-slate-800">
          <motion.div
            className="h-full bg-gradient-to-r from-clinical-primary via-indigo-500 to-blue-400"
            initial={{ width: '0%', left: '0%' }}
            animate={{
              width: ['0%', '30%', '70%', '100%'],
              left: ['0%', '20%', '60%', '100%']
            }}
            transition={{
              repeat: Infinity,
              duration: 1.5,
              ease: 'easeInOut'
            }}
            style={{ position: 'absolute' }}
          />
        </div>
      )}

      {/* Responsive mobile backdrop overlay */}
      {!isSidebarCollapsed && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsSidebarCollapsed(true)}
        />
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        onOpenJemmiChat={() => setIsJemmiOpen(true)}
      />

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <Navbar
          toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isSidebarCollapsed={isSidebarCollapsed}
        />

        {/* Page Content Wrapper */}
        <main className={`flex-grow pt-24 pb-12 px-4 lg:px-8 transition-all duration-300 pl-0 lg:pl-20 ${
          isSidebarCollapsed ? '' : 'lg:pl-64'
        }`}>
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Floating JEMMI Chat Assistant and Popup Drawer overlay */}
      <JemmiChatDrawer
        isOpen={isJemmiOpen}
        onClose={() => setIsJemmiOpen(false)}
        onOpen={() => setIsJemmiOpen(true)}
      />
    </div>
  );
}
