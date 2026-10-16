/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        clinical: {
          ink: '#0A2540',           // Navy text
          primary: '#006A61',       // Primary Teal
          primaryDark: '#005C54',   // Teal dark
          secondary: '#3A82F7',     // Secondary Blue
          bgApp: '#F7F9FC',         // Secondary background
          bgSurface: '#FFFFFF',     // White card/content container background
          border: '#DCE7F5',        // Light blue borders
          textPrimary: '#0A2540',   // Navy text
          textSecondary: '#4A607A', // Slate/gray secondary body text
          status: {
            critical: '#D32F2F',    // Danger Red
            warning: '#F59E0B',     // Warning orange
            caution: '#F59E0B',
            normal: '#14A44D',      // Success green
            info: '#3A82F7',        // Info Blue
          }
        },
        medical: {
          blue: '#3A82F7',
          sky: '#3A82F7',
          teal: '#006A61',
          success: '#14A44D',
          warning: '#F59E0B',
          danger: '#D32F2F',
          ink: '#0A2540',
          mist: '#EEF5FF',
        },
      },
      boxShadow: {
        soft: '0 1px 3px rgba(17,24,39,0.05), 0 1px 2px rgba(17,24,39,0.03)',
      },
      borderRadius: {
        clinical: '10px',
      },
      fontFamily: {
        serif: ['Inter', 'IBM Plex Sans', 'sans-serif'], // Fallback for any leftover serif tags
        sans: ['Inter', 'IBM Plex Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
