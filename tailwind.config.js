/** @type {import('tailwindcss').Config} */
// DESIGN SYSTEM — one place to retune the brand.
// Color psychology applied deliberately (not all colors equally):
//  - brand  (pink)   : primary identity + friendly interactive elements (buttons, links, focus)
//  - accent (orange) : energy -> the *important action* (Record payment) and "needs attention"
//  - mint   (green)  : money in / paid / positive progress ONLY
//  - white + warm neutrals (ink) : 80% of the UI, for cleanliness and trust
// Debt (money owed) uses the warm "debt" red-orange rather than alarming pure red.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF1F7', 100: '#FFE1EE', 200: '#FFC7E0', 300: '#FF9CC5', 400: '#F565A3',
          500: '#E8408C', 600: '#D12674', 700: '#AE1A5E', 800: '#8F194F', 900: '#781845',
        },
        accent: {
          50: '#FFF7ED', 100: '#FFEDD5', 200: '#FED7AA', 300: '#FDBA74', 400: '#FB9A45',
          500: '#F58220', 600: '#DB6410', 700: '#B54A0F',
        },
        mint: {
          50: '#F0FDF4', 100: '#DCFCE7', 200: '#BBF7D0', 300: '#86EFAC', 400: '#4ADE80',
          500: '#22C55E', 600: '#16A34A', 700: '#15803D',
        },
        ink: {
          50: '#FAF8F9', 100: '#F4F1F3', 200: '#E9E4E7', 300: '#D5CED2', 400: '#A59CA2',
          500: '#7A7077', 600: '#5C5359', 700: '#433B40', 800: '#2B2528', 900: '#1B1719',
        },
        danger: { 50: '#FEF2F2', 100: '#FEE2E2', 500: '#DC2626', 600: '#B91C1C' },
        info: { 50: '#EFF6FF', 100: '#DBEAFE', 500: '#2563EB', 600: '#1D4ED8' },
      },
      fontFamily: {
        // Fonts are bundled (@fontsource) so typography works offline too.
        sans: ['"Inter Variable"', '"Noto Sans Arabic Variable"', 'system-ui', 'sans-serif'],
        arabic: ['"Noto Sans Arabic Variable"', '"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem' },
      boxShadow: {
        // Deliberately subtle — trust over visual effects.
        card: '0 1px 2px rgba(27,23,25,0.04), 0 1px 1px rgba(27,23,25,0.03)',
        pop: '0 8px 24px rgba(27,23,25,0.12)',
      },
    },
  },
  plugins: [],
};
