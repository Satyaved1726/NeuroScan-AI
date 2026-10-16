import MaterialIcon from './MaterialIcon';
import { motion } from 'framer-motion';
import { useDarkMode } from '../hooks/useDarkMode';
import { useNotifications, NotificationItem } from '../contexts/NotificationContext';

const AlertCircle = ({ className }: { className?: string }) => <MaterialIcon name="warning" className={className} />;
const CheckCircle = ({ className }: { className?: string }) => <MaterialIcon name="check_circle" className={className} />;
const Clock = ({ className }: { className?: string }) => <MaterialIcon name="schedule" className={className} />;
const FileText = ({ className }: { className?: string }) => <MaterialIcon name="description" className={className} />;
const X = ({ className }: { className?: string }) => <MaterialIcon name="close" className={className} />;

interface NotificationCenterProps {
  onClose: () => void;
}

export default function NotificationCenter({ onClose }: NotificationCenterProps) {
  const { isDark } = useDarkMode();
  const { notifications, markAsRead, markAllAsRead, clearNotifications } = useNotifications();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case 'alert':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'info':
        return <Clock className="h-5 w-5 text-clinical-primary" />;
      default:
        return <FileText className="h-5 w-5 text-slate-500" />;
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return `${days}d ago`;
    } catch {
      return 'Pending';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={`absolute top-16 right-0 w-96 rounded-2xl shadow-2xl border ${
        isDark
          ? 'bg-slate-900 border-slate-700'
          : 'bg-white border-slate-200'
      } overflow-hidden z-50 font-sans`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${
        isDark ? 'border-slate-700' : 'border-slate-100'
      }`}>
        <div>
          <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Notification Logs
          </h3>
          <span className="text-[10px] text-clinical-textSecondary font-bold uppercase tracking-wider">
            Clinical Event Telemetry
          </span>
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className={`p-1.5 rounded-lg transition-colors ${
            isDark
              ? 'hover:bg-slate-800 text-slate-400'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          <X className="h-5 w-5" />
        </motion.button>
      </div>

      {/* Notifications List */}
      <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40">
        {notifications.length > 0 ? (
          notifications.map((notification, index) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              onClick={() => markAsRead(notification.id)}
              className={`p-4 cursor-pointer transition-colors ${
                isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
              } ${
                !notification.read && (isDark ? 'bg-slate-800/20' : 'bg-clinical-primary/5')
              }`}
            >
              <div className="flex gap-3">
                <div className="flex-shrink-0 mt-1">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs font-bold leading-tight ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}>
                      {notification.title}
                    </p>
                    {!notification.read && (
                      <div className="h-2 w-2 rounded-full bg-clinical-primary flex-shrink-0 mt-1 animate-pulse" />
                    )}
                  </div>
                  <p className={`text-xs mt-1 leading-normal font-semibold ${
                    isDark ? 'text-slate-450' : 'text-slate-500'
                  }`}>
                    {notification.message}
                  </p>
                  <p className="text-[10px] mt-2 text-slate-400 font-bold font-mono">
                    {formatTime(notification.timestamp)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="p-8 text-center text-xs font-semibold text-clinical-textSecondary">
            No clinical notifications logged
          </div>
        )}
      </div>

      {/* Footer Actions Panel */}
      <div className={`p-3.5 border-t flex justify-between gap-2 text-xs font-bold ${
        isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'
      }`}>
        <button
          onClick={markAllAsRead}
          disabled={notifications.filter(n => !n.read).length === 0}
          className="text-clinical-primary hover:text-clinical-primaryDark transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Mark all read
        </button>
        <button
          onClick={clearNotifications}
          disabled={notifications.length === 0}
          className="text-red-500 hover:text-red-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear all
        </button>
      </div>
    </motion.div>
  );
}
