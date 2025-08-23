/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'cyber-blue': '#00d4ff',
        'cyber-dark': '#1e3c72',
        'cyber-gradient-start': '#1e3c72',
        'cyber-gradient-end': '#2a5298',
      },
      fontFamily: {
        'cyber': ['Orbitron', 'sans-serif'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'cyber-pulse': 'cyber-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          'from': { textShadow: '0 0 20px #00d4ff, 0 0 30px #00d4ff, 0 0 40px #00d4ff' },
          'to': { textShadow: '0 0 30px #00d4ff, 0 0 40px #00d4ff, 0 0 50px #00d4ff' },
        },
        'cyber-pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
      },
      backgroundImage: {
        'cyber-gradient': 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
        'cyber-radial': 'radial-gradient(circle at center, rgba(0, 212, 255, 0.1) 0%, transparent 70%)',
      },
    },
  },
  plugins: [],
}