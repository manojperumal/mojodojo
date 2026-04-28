import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: '#FBF8F3',
        ink: '#1A1A1A',
        terra: '#C75A3F',
        muted: '#6B6459',
        border: '#E8E3DB',
      },
      fontFamily: {
        display: ['Canela', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        input: '8px',
        chip: '8px',
        pill: '4px',
      },
      boxShadow: {
        warm: '0 2px 8px rgba(26,26,26,0.08)',
        'warm-lg': '0 4px 16px rgba(26,26,26,0.12)',
      },
      spacing: {
        unit: '24px',
      },
      maxWidth: {
        app: '480px',
      },
    },
  },
  plugins: [],
}

export default config
