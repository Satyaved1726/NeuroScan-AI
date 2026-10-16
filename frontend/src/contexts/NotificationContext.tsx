import React, { createContext, useContext, useState, useEffect } from 'react';

export interface NotificationItem {
  id: string;
  type: 'success' | 'warning' | 'info' | 'alert';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface NotificationContextProps {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (type: 'success' | 'warning' | 'info' | 'alert', title: string, message: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem('neuroscan_notifications');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback to initial mock if parse fails
      }
    }
    // Initial clinical notifications list
    return [
      {
        id: 'init-1',
        type: 'success',
        title: 'Scan Completed',
        message: 'MRI sequence #NSA-9938 processed successfully on ResNet-50 pipeline.',
        timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
        read: false,
      },
      {
        id: 'init-2',
        type: 'info',
        title: 'Report Generated',
        message: 'Signed clinical PDF report prepared for John Doe is ready.',
        timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
        read: false,
      },
      {
        id: 'init-3',
        type: 'info',
        title: 'Assistant Replied',
        message: 'Jemmi AI replied to your inquiry about hippocampal volumetric markers.',
        timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
        read: true,
      },
      {
        id: 'init-4',
        type: 'success',
        title: 'Profile Updated',
        message: 'Clinician signature card and avatar successfully saved to settings.',
        timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
        read: true,
      },
    ];
  });

  useEffect(() => {
    localStorage.setItem('neuroscan_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addNotification = (type: 'success' | 'warning' | 'info' | 'alert', title: string, message: string) => {
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
