import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b1220',
        panel: '#101b2d',
        tile: '#1c3d5e',
        accent: '#fbbf24',
        mint: '#34d399',
        coral: '#f97316',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(251,191,36,0.35), 0 12px 40px rgba(15,23,42,0.45)',
      },
    },
  },
  plugins: [],
};

export default config;
