import MaterialIcon from './MaterialIcon';

const LogOut = ({ className }: { className?: string }) => <MaterialIcon name="logout" className={className} />;
const Settings = ({ className }: { className?: string }) => <MaterialIcon name="settings" className={className} />;
const User = ({ className }: { className?: string }) => <MaterialIcon name="person" className={className} />;
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useDarkMode } from '../hooks/useDarkMode';

interface UserMenuProps {
  onClose: () => void;
}

export default function UserMenu({ onClose }: UserMenuProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark } = useDarkMode();

  const handleLogout = async () => {
    await logout();
    navigate('/');
    onClose();
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={`absolute top-16 right-0 w-56 rounded-2xl shadow-2xl border overflow-hidden ${
        isDark
          ? 'bg-slate-900 border-slate-700'
          : 'bg-white border-slate-200'
      }`}
    >
      {/* User Info */}
      <div className={`p-4 border-b ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold ${
            isDark ? 'bg-medical-blue' : 'bg-medical-blue'
          }`}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold truncate ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              {user?.name}
            </p>
            <p className={`text-xs truncate ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
              {user?.email}
            </p>
          </div>
        </div>
        <div className={`mt-3 px-3 py-1 rounded-lg w-fit text-xs font-medium ${
          isDark
            ? 'bg-medical-blue/20 text-medical-blue'
            : 'bg-medical-blue/10 text-medical-blue'
        }`}>
          {user && (user.role.charAt(0).toUpperCase() + user.role.slice(1))}
        </div>
      </div>

      {/* Menu Items */}
      <div className="py-2">
        <motion.button
          whileHover={{ x: 4 }}
          onClick={() => handleNavigation('/profile')}
          className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
            isDark
              ? 'text-slate-300 hover:bg-slate-800'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <User className="h-4 w-4" />
          View Profile
        </motion.button>

        <motion.button
          whileHover={{ x: 4 }}
          onClick={() => handleNavigation('/settings')}
          className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
            isDark
              ? 'text-slate-300 hover:bg-slate-800'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Settings className="h-4 w-4" />
          Settings
        </motion.button>
      </div>

      {/* Divider */}
      <div className={`h-px ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`} />

      {/* Logout */}
      <motion.button
        whileHover={{ x: 4 }}
        onClick={handleLogout}
        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
          isDark
            ? 'text-red-400 hover:bg-red-900/20'
            : 'text-red-600 hover:bg-red-50'
        }`}
      >
        <LogOut className="h-4 w-4" />
        Logout
      </motion.button>
    </motion.div>
  );
}
