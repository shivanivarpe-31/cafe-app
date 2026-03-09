module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f1',
          100: '#ffe0e0',
          200: '#ffc5c5',
          300: '#ff9d9d',
          400: '#ff6464',
          500: '#f83535',
          600: '#e51414',
          700: '#c10d0d',
          800: '#a00f0f',
          900: '#841414',
          950: '#480404',
        },
        surface: {
          50: '#fafaf9',
          100: '#f5f5f3',
          200: '#e8e8e4',
          300: '#d4d4cd',
        },
        ink: {
          900: '#1a1a18',
          700: '#3d3d38',
          500: '#6b6b63',
          400: '#8c8c83',
          300: '#b3b3aa',
        },
      },
      fontFamily: {
        sans: ['Inter', '"Segoe UI"', 'system-ui', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'brand-sm': '0 1px 3px 0 rgba(229,20,20,.12), 0 1px 2px -1px rgba(229,20,20,.08)',
        'brand': '0 4px 14px 0 rgba(229,20,20,.18), 0 2px 6px -1px rgba(229,20,20,.10)',
        'brand-lg': '0 10px 30px -3px rgba(229,20,20,.22), 0 4px 12px -4px rgba(229,20,20,.14)',
        'card': '0 1px 4px 0 rgba(0,0,0,.06), 0 1px 2px -1px rgba(0,0,0,.04)',
        'card-hover': '0 8px 24px -4px rgba(0,0,0,.10), 0 2px 8px -2px rgba(0,0,0,.06)',
        'nav': '0 1px 0 0 rgba(0,0,0,.06)',
        'glass': '0 8px 32px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.6)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #e51414 0%, #c10d0d 100%)',
        'brand-gradient-light': 'linear-gradient(135deg, #f83535 0%, #e51414 50%, #c10d0d 100%)',
        'warm-grid': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.06'%3E%3Cpath d='M0 38.59l2.83-2.83 1.41 1.41L1.41 40H0v-1.41zM0 1.4l2.83 2.83 1.41-1.41L1.41 0H0v1.41zM38.59 40l-2.83-2.83 1.41-1.41L40 38.59V40h-1.41zM40 1.41l-2.83 2.83-1.41-1.41L38.59 0H40v1.41z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.22s ease-out both',
        'fade-in': 'fade-in 0.18s ease-out both',
        'scale-in': 'scale-in 0.18s ease-out both',
      },
    }
  },
  plugins: [],
}
