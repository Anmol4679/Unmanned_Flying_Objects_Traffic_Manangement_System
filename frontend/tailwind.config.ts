import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./shared/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        utm: {
          bg: "#090d16",
          surface: "#0f172a",
          card: "#15203b",
          cardHover: "#1b294b",
          border: "#1e293b",
          borderLight: "#334155",
          muted: "#94a3b8",
        },
        brand: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9", // Sky primary
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },
        status: {
          idle: "#10b981", // Emerald
          inflight: "#0ea5e9", // Sky Blue
          maintenance: "#f59e0b", // Amber
          suspended: "#ef4444", // Rose / Red
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      boxShadow: {
        glow: "0 0 20px -5px rgba(14, 165, 233, 0.3)",
        card: "0 4px 20px -2px rgba(0, 0, 0, 0.4)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
    },
  },
  plugins: [],
};

export default config;
