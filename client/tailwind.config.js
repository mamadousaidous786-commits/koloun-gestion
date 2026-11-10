/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Bleu (accent) — gardé sous le nom "or" pour que toutes les pages existantes en profitent
        or: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#2563eb',
          400: '#3b82f6',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a',
          900: '#1e3a8a',
        },
        // Neutres clairs : texte sombre, fonds blancs / gris très clair
        charbon: {
          50: '#0f172a',
          100: '#475569',
          800: '#f1f5f9',
          900: '#ffffff',
          950: '#f4f7fb',
        },
        // Bleu marine de la barre latérale
        marine: {
          600: '#1b3a7a',
          700: '#14306b',
          800: '#0f2557',
          900: '#0a1b42',
        },
      },
      fontFamily: {
        serif: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -10px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [],
};
