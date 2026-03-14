const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
        },
        sidebar: {
          DEFAULT: '#1e293b',
          hover: '#334155',
        },
        surface: {
          DEFAULT: '#f8fafc',
          card: '#ffffff',
        },
        ok: '#16a34a',
        over: '#dc2626',
        pending: '#f59e0b',
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};
