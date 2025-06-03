/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'media', // Pure CSS automatic theme detection
  theme: {
    extend: {
      colors: {
        // Keep current color scheme exactly
        'query-success': '#10b981',
        'query-error': '#ef4444',
        'query-loading': '#3b82f6',
        'query-idle': '#6b7280',
        'query-stale': '#f59e0b'
      }
    },
  },
  plugins: [],
}
