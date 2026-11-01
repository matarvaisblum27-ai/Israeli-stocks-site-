import type { Config } from 'tailwindcss';

/*
 * Apple-style palette.
 * `slate` is remapped to neutral (non-blue) grays so every existing
 * slate-* class across the app picks up the new look automatically.
 */
const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#000000',
        panel: '#1d1d1f',
        border: '#2c2c2e',
        muted: '#86868b',
        accent: '#2997ff',
        ink: '#f5f5f7',
        titanium: '#a1a1a6',
        slate: {
          50: '#fbfbfd',
          100: '#f5f5f7',
          200: '#e8e8ed',
          300: '#d2d2d7',
          400: '#a1a1a6',
          500: '#86868b',
          600: '#6e6e73',
          700: '#424245',
          800: '#2c2c2e',
          900: '#1d1d1f',
          950: '#0a0a0a',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Hebrew"',
          '"Segoe UI"',
          'Arial',
          'sans-serif',
        ],
      },
      transitionTimingFunction: {
        apple: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        '600': '600ms',
        '900': '900ms',
      },
    },
  },
  plugins: [],
};
export default config;
