import { ReactNode } from 'react';
const ActivitySquare = () => null;
const Brain = () => null;
const FileText = () => null;
const Home = () => null;
const ScanSearch = () => null;
const Settings = () => null;
const Shield = () => null;
const Sparkles = () => null;
const Stethoscope = () => null;
const UserCircle2 = () => null;

export type RouteType = 'public' | 'protected' | 'admin' | 'auth';

export interface RouteConfig {
  path: string;
  pageKey: 'landing' | 'login' | 'register' | 'dashboard' | 'analysis' | 'results' | 'assistant' | 'reports' | 'history' | 'profile' | 'settings' | 'admin' | 'not-found';
  label: string;
  icon?: typeof Home;
  type: RouteType;
  showInNav: boolean;
  requiresAuth: boolean;
  requiresAdmin: boolean;
}

export interface NavItem {
  path: string;
  label: string;
  icon: typeof Home;
  requiresAuth: boolean;
  requiresAdmin: boolean;
}

// Centralized route configuration (without JSX)
export const routes: RouteConfig[] = [
  // Public routes
  {
    path: '/',
    pageKey: 'landing',
    label: 'Landing',
    icon: Home,
    type: 'public',
    showInNav: true,
    requiresAuth: false,
    requiresAdmin: false,
  },
  {
    path: '/login',
    pageKey: 'login',
    label: 'Login',
    icon: Shield,
    type: 'auth',
    showInNav: false,
    requiresAuth: false,
    requiresAdmin: false,
  },
  {
    path: '/register',
    pageKey: 'register',
    label: 'Register',
    icon: UserCircle2,
    type: 'auth',
    showInNav: false,
    requiresAuth: false,
    requiresAdmin: false,
  },

  // Protected routes
  {
    path: '/dashboard',
    pageKey: 'dashboard',
    label: 'Dashboard',
    icon: ActivitySquare,
    type: 'protected',
    showInNav: true,
    requiresAuth: true,
    requiresAdmin: false,
  },
  {
    path: '/analysis',
    pageKey: 'analysis',
    label: 'MRI Analysis',
    icon: ScanSearch,
    type: 'protected',
    showInNav: true,
    requiresAuth: true,
    requiresAdmin: false,
  },
  {
    path: '/results',
    pageKey: 'results',
    label: 'Results',
    icon: Brain,
    type: 'protected',
    showInNav: false,
    requiresAuth: true,
    requiresAdmin: false,
  },
  {
    path: '/results/:scanId',
    pageKey: 'results',
    label: 'Results',
    icon: Brain,
    type: 'protected',
    showInNav: false,
    requiresAuth: true,
    requiresAdmin: false,
  },
  {
    path: '/assistant',
    pageKey: 'assistant',
    label: 'Clinical Assistant',
    icon: Sparkles,
    type: 'protected',
    showInNav: true,
    requiresAuth: true,
    requiresAdmin: false,
  },
  {
    path: '/reports',
    pageKey: 'reports',
    label: 'Reports',
    icon: FileText,
    type: 'protected',
    showInNav: true,
    requiresAuth: true,
    requiresAdmin: false,
  },
  {
    path: '/history',
    pageKey: 'history',
    label: 'History',
    icon: Stethoscope,
    type: 'protected',
    showInNav: true,
    requiresAuth: true,
    requiresAdmin: false,
  },
  {
    path: '/profile',
    pageKey: 'profile',
    label: 'Profile',
    icon: UserCircle2,
    type: 'protected',
    showInNav: true,
    requiresAuth: true,
    requiresAdmin: false,
  },
  {
    path: '/settings',
    pageKey: 'settings',
    label: 'Settings',
    icon: Settings,
    type: 'protected',
    showInNav: true,
    requiresAuth: true,
    requiresAdmin: false,
  },

  // Admin routes
  {
    path: '/admin',
    pageKey: 'admin',
    label: 'Admin',
    icon: Shield,
    type: 'admin',
    showInNav: true,
    requiresAuth: true,
    requiresAdmin: true,
  },

  // Error route
  {
    path: '*',
    pageKey: 'not-found',
    label: 'Not Found',
    type: 'public',
    showInNav: false,
    requiresAuth: false,
    requiresAdmin: false,
  },
];

export function getNavItems(isAuthenticated: boolean, isAdmin: boolean): NavItem[] {
  return routes
    .filter(
      (route) =>
        route.showInNav &&
        (!route.requiresAuth || isAuthenticated) &&
        (!route.requiresAdmin || isAdmin)
    )
    .map((route) => ({
      path: route.path,
      label: route.label,
      icon: route.icon!,
      requiresAuth: route.requiresAuth,
      requiresAdmin: route.requiresAdmin,
    }));
}
