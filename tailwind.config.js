/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'media', // Enable automatic dark mode based on system preference
  theme: {
    extend: {
      colors: {
        // Enhanced colors for better dark mode support
        gray: {
          750: '#374151', // Between gray-700 and gray-800 for better gradients
        }
      }
    },
  },
  plugins: [],
}
