/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0c0e14',
        surface: {
          DEFAULT: '#141721',
          subtle: '#1a1f2c',
          border: '#23293b',
          hover: '#202738',
        },
        brand: {
          DEFAULT: '#38bdf8',
          hover: '#0ea5e9',
          glow: 'rgba(56, 189, 248, 0.15)',
        },
        git: {
          added: '#22c55e',
          modified: '#38bdf8',
          deleted: '#ef4444',
          renamed: '#a855f7',
          untracked: '#eab308',
          head: '#f59e0b',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
