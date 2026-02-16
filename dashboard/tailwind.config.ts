import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ["class"],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "#0a0a0f",
        foreground: "#ffffff",
        primary: {
          DEFAULT: "#3b82f6",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#12121a",
          foreground: "#ffffff",
        },
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#ffffff",
        },
        success: {
          DEFAULT: "#22c55e",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#1a1a2e",
          foreground: "#a1a1aa",
        },
        accent: {
          DEFAULT: "#16213e",
          foreground: "#ffffff",
        },
        popover: {
          DEFAULT: "#12121a",
          foreground: "#ffffff",
        },
        card: {
          DEFAULT: "#12121a",
          foreground: "#ffffff",
        },
        chart: {
          "1": "#22c55e",
          "2": "#ef4444",
          "3": "#3b82f6",
          "4": "#f59e0b",
          "5": "#8b5cf6",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
}

export default config