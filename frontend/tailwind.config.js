/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        adventista: {
          azul: '#244936',
          dorado: '#C9A45E',
          rojo: '#B75D4A',
          verde: '#6F8759',
        }
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['DM Serif Display', 'Georgia', 'serif'],
      }
    },
  },
  plugins: [],
};
