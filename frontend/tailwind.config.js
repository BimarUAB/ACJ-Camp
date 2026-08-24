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
          azul: '#2E5AAC',
          dorado: '#D4A017',
          rojo: '#C41E3A',
          verde: '#228B22',
        }
      }
    },
  },
  plugins: [],
};
