/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        or: {
          50: '#faf6ec',
          100: '#f0e6c8',
          200: '#e0cb8f',
          300: '#c9a94f',
          400: '#b4923c',
          500: '#9c7a26',
          600: '#836420',
          700: '#69501a',
          800: '#523e15',
          900: '#3d2f14',
        },
        charbon: {
          50: '#211d17',
          100: '#6b6255',
          800: '#f1ede4',
          900: '#ffffff',
          950: '#faf8f4',
        },
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Playfair Display', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 20px -4px rgba(33, 29, 23, 0.08)',
      },
    },
  },
  plugins: [],
};
