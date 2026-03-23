import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./entrypoints/**/*.{html,ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#7c3aed',
        panel: '#f9f9f9',
        rail: '#f4f4f5',
        text: '#1a1a1a',
      },
    },
  },
  plugins: [],
} satisfies Config;
