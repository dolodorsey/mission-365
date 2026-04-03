import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        gold: '#D4B87A',
        midnight: '#0A0E1A',
        cream: '#F5F0E8',
        emerald: '#2ECC71',
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'serif'],
        body: ['DM Sans', 'sans-serif'],
      }
    }
  },
  plugins: []
}
export default config
