import { createContext, ReactNode, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'medical';

interface DarkModeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  isDark: boolean;
  toggleDarkMode: () => void;
}

export const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);

export function DarkModeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme') as ThemeMode;
    if (saved === 'light' || saved === 'dark' || saved === 'medical') {
      return saved;
    }
    // Fallback to legacy darkMode state
    const legacy = localStorage.getItem('darkMode');
    if (legacy === 'true') return 'dark';
    if (legacy === 'false') return 'light';

    // Check browser preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    localStorage.setItem('darkMode', (theme === 'dark' || theme === 'medical').toString());

    // Set custom attribute for CSS styling
    document.documentElement.setAttribute('data-theme', theme);

    // Add/remove legacy dark class for standard tailwind components
    if (theme === 'dark' || theme === 'medical') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleDarkMode = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const isDark = theme === 'dark' || theme === 'medical';

  return (
    <DarkModeContext.Provider value={{ theme, setTheme: setThemeState, isDark, toggleDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
}
