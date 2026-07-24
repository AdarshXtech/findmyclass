/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist Variable', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk Variable', 'Geist Variable', 'sans-serif'],
        mono: ['Geist Mono Variable', 'ui-monospace', 'monospace'],
      },
      colors: {
        surface: {
          primary: 'var(--surface-primary)',
          secondary: 'var(--surface-secondary)',
          muted: 'var(--surface-muted)',
          highlight: 'var(--surface-highlight)',
          inverse: 'var(--surface-inverse)',
          'primary-soft': 'var(--surface-primary-soft)',
          'primary-subtle': 'var(--surface-primary-subtle)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          'on-dark': 'var(--text-on-dark)',
          'on-accent': 'var(--text-on-accent)',
          'muted-inverse': 'var(--text-muted-inverse)',
        },
        border: {
          DEFAULT: 'var(--border-default)',
          default: 'var(--border-default)',
          strong: 'var(--border-strong)',
          input: 'var(--border-input)',
          inverse: 'var(--border-inverse)',
        },
        accent: {
          primary: 'var(--accent-primary)',
          strong: 'var(--accent-strong)',
          highlight: 'var(--accent-highlight)',
        },
        status: {
          danger: 'var(--danger)',
          success: 'var(--success)',
          warning: 'var(--warning-text)',
        },
        overlay: {
          dialog: 'var(--overlay-dialog)',
        },
        focus: {
          DEFAULT: 'var(--focus-ring)',
          soft: 'var(--focus-ring-soft)',
        },
        navy: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#1e293b',
          800: '#0f172a',
          900: '#020617',
        }
      },
      boxShadow: {
        brand: '8px 8px 0 var(--accent-primary)',
        'brand-lg': '10px 10px 0 var(--accent-primary)',
        admin: 'var(--shadow-admin)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'slide-down': 'slideDown 0.4s ease-out forwards',
        'scale-in': 'scaleIn 0.4s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      }
    },
  },
  plugins: [],
}
