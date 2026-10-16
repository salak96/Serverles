/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0B0D12', sidebar: '#10131A', card: '#151922' },
        line: { DEFAULT: '#272C36' },
        accent: { DEFAULT: '#FF8A00', hover: '#FF6A00' },
        ink: { DEFAULT: '#F5F5F5', muted: '#9CA3AF' },
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