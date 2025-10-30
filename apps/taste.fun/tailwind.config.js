/**** Tailwind Config for Consensus PWA ****/
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#121212',
        surface: '#181818',
        muted: '#b3b3b3',
        brand: {
          DEFAULT: '#1DB954',
          foreground: '#121212',
          hover: '#1ed760'
        },
      },
      borderRadius: {
        lg: '12px',
      },
      boxShadow: {
        "elevate": '0 8px 24px rgba(0,0,0,0.3)'
      }
    },
  },
  plugins: [],
};
