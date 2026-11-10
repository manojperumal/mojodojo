/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
      colors: {
        brand: { 50: '#fff8e6', 100: '#feecbf', 400: '#f4b42a', 500: '#e8a317', 600: '#c98510', 700: '#a0660e' },
        ink: { 900: '#0f172a', 800: '#1e293b', 700: '#334155' },
        ready: { 50: '#ecfdf3', 100: '#d1fadf', 600: '#15803d', 700: '#166534' },
        constrained: { 50: '#fff7ed', 100: '#ffedd5', 600: '#c2410c', 700: '#9a3412' },
        risk: { 50: '#fef2f2', 100: '#fee2e2', 600: '#dc2626', 700: '#b91c1c' },
      },
    },
  },
  plugins: [],
};
