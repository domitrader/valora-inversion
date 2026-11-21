/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        valora: {
          primary: '#10B981',    // Emerald green for primary accent / buttons
          primaryHover: '#059669',
          positive: '#10B981',  // Gain green
          negative: '#EF4444',  // Loss red / salmon
          negativeMuted: '#F87171',
          coral: '#F97316',     // Orange coral for 1D active badge
          bg: '#FFFFFF',
          card: '#F8FAFC',
          border: '#E2E8F0',
          dark: '#0F172A',
          subtext: '#64748B',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
      }
    },
  },
  plugins: [],
}
