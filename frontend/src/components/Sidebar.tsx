import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useProfilePhoto } from '../hooks/useProfilePhoto';
import { useLanguage } from '../hooks/useLanguage';
import { useToastContext } from '../hooks/useToastContext';
import { useMRIWorkflow } from '../hooks/useMRIWorkflow';
import ProfileAvatar from './ProfileAvatar';
import MaterialIcon from './MaterialIcon';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onOpenJemmiChat?: () => void;
}

export default function Sidebar({ isCollapsed, setIsCollapsed, onOpenJemmiChat }: SidebarProps) {
  const { user, logout } = useAuth();
  const { photoUrl } = useProfilePhoto();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const toast = useToastContext();
  const { state: workflowState } = useMRIWorkflow();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Determine active badges based on workflow state
  const isWorkflowActive = workflowState.currentStep !== 'idle' && workflowState.currentStep !== 'success' && workflowState.currentStep !== 'error';

  const navLinks = [
    { to: '/dashboard', labelKey: 'sidebar_dashboard', label: 'Dashboard', icon: 'dashboard' },
    ...(user?.role === 'Doctor' || user?.role === 'Admin' ? [{
      to: '/analysis',
      labelKey: 'sidebar_new_scan',
      label: 'New MRI Scan',
      icon: 'upload_file',
      badge: isWorkflowActive ? { text: 'RUN', type: 'active' } : null
    }] : []),
    { to: '/results', labelKey: 'sidebar_results', label: 'Results', icon: 'analytics' },
    { to: '/reports', labelKey: 'sidebar_reports', label: 'Reports', icon: 'description' },
    { to: '/assistant', labelKey: 'sidebar_assistant', label: 'AI Assistant', icon: 'chat', badge: { text: 'AI', type: 'ai' } },
    { to: '#support', labelKey: 'sidebar_support', label: 'Support', icon: 'support_agent' },
  ];

  return (
    <aside
      className={`fixed top-0 bottom-0 z-40 bg-[#EEF5FF] dark:bg-[#0C111C] border-r border-clinical-border dark:border-slate-800 flex flex-col justify-between transition-all duration-300 ${
        isCollapsed ? '-left-64 lg:left-0 lg:w-20' : 'left-0 w-64'
      }`}
    >
      {/* Top Brand Block */}
      <div>
        <div className="h-16 flex items-center justify-between px-4 border-b border-clinical-border dark:border-slate-800">
          <div className="flex items-center gap-2 overflow-hidden truncate">
            <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-[10px] bg-clinical-primary text-white">
              <MaterialIcon name="neurology" className="text-[20px]" />
            </div>
            {!isCollapsed && (
              <span className="font-bold text-sm tracking-tight text-clinical-ink dark:text-white truncate">
                NEUROSCAN <span className="text-clinical-primary font-bold">AI</span>
              </span>
            )}
          </div>

          {/* Collapse/Expand Toggle Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-clinical-textSecondary hidden lg:block"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <MaterialIcon name={isCollapsed ? 'chevron_right' : 'chevron_left'} className="text-[18px]" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="p-3 space-y-1">
          {navLinks.map((link) => (
            <NavLink
              key={`${link.to}-${link.labelKey}`}
              to={link.to}
              onClick={(e) => {
                if (link.to.startsWith('#')) {
                  e.preventDefault();
                  toast.info("NeuroScan PACS Support: support@neuroscan.ai | Helpline: 1-800-NEURO");
                } else if (link.to === '/assistant' && onOpenJemmiChat) {
                  e.preventDefault();
                  onOpenJemmiChat();
                }
              }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-clinical text-xs font-bold transition-all relative ${
                  isActive && !link.to.startsWith('#')
                    ? 'bg-clinical-primary/10 text-clinical-primary dark:bg-slate-800 dark:text-clinical-primary border-l-4 border-clinical-primary'
                    : 'text-clinical-textSecondary hover:text-clinical-ink dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/40'
                }`
              }
              title={isCollapsed ? t(link.labelKey, link.label) : undefined}
            >
              <MaterialIcon name={link.icon} className="text-[20px] shrink-0" />
              {!isCollapsed && <span className="truncate flex-1">{t(link.labelKey, link.label)}</span>}

              {/* Badges */}
              {!isCollapsed && link.badge && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase scale-90 ${
                  link.badge.type === 'active'
                    ? 'bg-clinical-primary text-white animate-pulse'
                    : link.badge.type === 'ai'
                    ? 'bg-purple-550/10 text-purple-600 border border-purple-500/20'
                    : 'bg-clinical-primary/10 text-clinical-primary border border-clinical-primary/20'
                }`}>
                  {link.badge.text}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Bottom Profile / Logout Block */}
      <div className="p-3 border-t border-clinical-border dark:border-slate-800">
        <div
          onClick={() => navigate('/profile')}
          className={`flex items-center gap-3 cursor-pointer rounded-clinical hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors ${
            isCollapsed ? 'justify-center p-1.5' : 'px-2 py-1.5'
          }`}
          title="Open Profile Settings"
        >
          <ProfileAvatar src={photoUrl} name={user?.name} sizeClassName="h-8 w-8 shrink-0" />
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-clinical-ink dark:text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-clinical-textSecondary truncate uppercase font-bold tracking-wider">{user?.role || 'Clinician'}</p>
            </div>
          )}
        </div>

        {/* Account Settings button */}
        <button
          onClick={() => navigate('/profile')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 mt-2 rounded-clinical text-xs font-bold text-clinical-textSecondary hover:text-clinical-ink dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title="Account Settings"
        >
          <MaterialIcon name="settings" className="text-[20px] shrink-0" />
          {!isCollapsed && <span className="truncate">{t('sidebar_settings', 'Settings')}</span>}
        </button>

        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 mt-1 rounded-clinical text-xs font-bold text-clinical-status-critical hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title="Sign out of system"
        >
          <MaterialIcon name="logout" className="text-[20px] shrink-0" />
          {!isCollapsed && <span className="truncate">{t('sidebar_logout', 'Logout')}</span>}
        </button>
      </div>
    </aside>
  );
}
