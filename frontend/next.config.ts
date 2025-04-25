import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  theme: {
    extend: {
      keyframes: {
        gradient: {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        gradient: 'gradient 4s ease-in-out infinite',
      },
    },
  },
};

export default nextConfig;
