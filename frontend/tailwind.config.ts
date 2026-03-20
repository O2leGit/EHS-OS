import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f0f4fa",
          100: "#d9e2f0",
          200: "#b3c5e1",
          300: "#8da8d2",
          400: "#678bc3",
          500: "#416eb4",
          600: "#345890",
          700: "#27426c",
          800: "#1B2A4A",
          900: "#0f1a2e",
          950: "#080d17",
        },
        safe: "#2ECC71",
        warning: "#F59E0B",
        critical: "#EF4444",
      },
    },
  },
  plugins: [],
};
export default config;
