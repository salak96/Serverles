/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0B0B0B', sidebar: '#0E1118', card: '#12141A' },
        line: { DEFAULT: '#272C36' },
        accent: { DEFAULT: '#FF8A00', hover: '#FFA126' },
        ink: { DEFAULT: '#F8FAFC', muted: '#94A3B8' },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)',
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
  plugins: [],
};