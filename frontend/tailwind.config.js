/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        // Modern Gallery palette - dramatic B&W with electric coral
        gallery: {
          50: '#fafafa',
          100: '#f5f5f5',
          150: '#eeeeee',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          850: '#171717',
          900: '#0a0a0a',
          950: '#050505',
        },
        coral: {
          50: '#fff1ee',
          100: '#ffe4dd',
          200: '#ffc9b5',
          300: '#ff9e7d',
          400: '#ff6e4d',
          500: '#ff4d2a',  // Main electric coral
          600: '#e63818',
          700: '#c0270c',
          800: '#9f1c04',
          900: '#831400',
        },
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
      },
      boxShadow: {
        'gallery-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'gallery': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        'gallery-md': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
        'gallery-lg': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.05)',
        'gallery-xl': '0 25px 50px -12px rgb(0 0 0 / 0.15)',
        'coral-sm': '0 1px 2px 0 rgb(255 77 42 / 0.1)',
        'coral': '0 4px 14px 0 rgb(255 77 42 / 0.15)',
        'coral-lg': '0 8px 30px 0 rgb(255 77 42 / 0.25)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'shimmer': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.4s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
      },
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: theme('colors.gallery-700'),
            fontSize: '1.0625rem',
            lineHeight: '1.75',
            a: {
              color: theme('colors.coral-500'),
              textDecoration: 'none',
              fontWeight: '500',
              borderBottomWidth: '1px',
              borderBottomColor: 'transparent',
              transition: 'all 150ms ease',
              '&:hover': {
                color: theme('colors.coral-600'),
                borderBottomColor: theme('colors.coral-300'),
              },
            },
            'h1, h2, h3, h4, h5, h6': {
              fontFamily: theme('fontFamily.display'),
              fontWeight: '600',
              color: theme('colors.gallery-900'),
              marginTop: '1.75em',
              marginBottom: '0.75em',
              letterSpacing: '-0.025em',
            },
            h1: {
              fontSize: '2rem',
              lineHeight: '1.2',
            },
            h2: {
              fontSize: '1.625rem',
              lineHeight: '1.3',
            },
            h3: {
              fontSize: '1.375rem',
            },
            h4: {
              fontSize: '1.125rem',
            },
            p: {
              marginTop: '0',
              marginBottom: '1.25em',
            },
            'p:first-of-type': {
              fontSize: '1.125rem',
              fontWeight: '400',
            },
            'ul, ol': {
              marginTop: '1.25em',
              marginBottom: '1.25em',
              paddingLeft: '1.5em',
            },
            li: {
              marginTop: '0.5em',
              marginBottom: '0.5em',
            },
            blockquote: {
              fontWeight: '400',
              fontStyle: 'italic',
              color: theme('colors.gallery-600'),
              borderLeftWidth: '3px',
              borderLeftColor: theme('colors.coral-400'),
              paddingLeft: '1.25em',
              marginLeft: '0',
              marginTop: '1.5em',
              marginBottom: '1.5em',
              fontSize: '1.125rem',
            },
            code: {
              fontWeight: '500',
              backgroundColor: theme('colors.gallery-100'),
              padding: '0.2em 0.4em',
              borderRadius: '0.25em',
              fontSize: '0.9em',
              color: theme('colors.coral-600'),
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            pre: {
              backgroundColor: theme('colors.gallery-900'),
              color: theme('colors.gallery-100'),
              padding: '1em',
              borderRadius: '0.5em',
              overflowX: 'auto',
              marginTop: '1.5em',
              marginBottom: '1.5em',
              fontSize: '0.875rem',
            },
            'pre code': {
              backgroundColor: 'transparent',
              padding: '0',
              color: 'inherit',
            },
            img: {
              marginTop: '2em',
              marginBottom: '2em',
              borderRadius: '0.5em',
              boxShadow: theme('boxShadow.gallery'),
            },
            hr: {
              borderTopColor: theme('colors.gallery-200'),
              marginTop: '2.5em',
              marginBottom: '2.5em',
            },
            strong: {
              fontWeight: '600',
              color: theme('colors.gallery-900'),
            },
          },
        },
      }),
    },
  },
  plugins: [typography],
};
