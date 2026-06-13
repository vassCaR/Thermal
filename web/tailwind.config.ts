import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ghost: {
          bg: "#18181A", // logo: dark square
          panel: "#1F1F21", // logo: dominant charcoal
          border: "#2E2E31",
          accent: "#3459b5", // blue — matches the Dither + logo stroke
          accent2: "#5B7FD4", // lighter blue (gradients/hover)
          muted: "#8A8A90",
          fg: "#FFFFFF",
        },
      },
      fontFamily: {
        montserrat: ["var(--font-montserrat)", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
