import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ivory: "#E9E7DB",
        bronze: "#967751",
        ink: "#000000",
        paper: "#FFFFFF",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: { card: "0 1px 4px rgba(0,0,0,0.08)", pop: "0 6px 24px rgba(0,0,0,0.12)" },
      borderRadius: { DEFAULT: "2px", sm: "2px", md: "4px" },
      letterSpacing: { tightest: "-0.03em" },
      transitionTimingFunction: { "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)" },
    },
  },
  plugins: [],
} satisfies Config;
