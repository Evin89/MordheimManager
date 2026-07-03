/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b0a09',
          900: '#141210',
          800: '#1f1c19',
          700: '#2b2724',
        },
        bone: {
          100: '#f2ead9',
          200: '#e6d9bf',
          300: '#d8c6a1',
        },
        ember: {
          400: '#f2751a',
          500: '#dc5c0e',
          600: '#b6480a',
        },
        blood: {
          500: '#9f1d1d',
          600: '#7f1717',
        },
      },
    },
  },
  plugins: [],
};
