import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Outfit", "system-ui", "sans-serif"],
        display: ["Outfit", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Prism design system colors
        obsidian: {
          DEFAULT: "#1A1625",
          light: "#2A2436",
          mid: "#3D3550",
          50: "#F8F6F3",
          100: "#E8E4ED",
          200: "#D0CAD8",
          300: "#A8A0B8",
          400: "#7B7290",
          500: "#5A5170",
          600: "#3D3550",
          700: "#2A2436",
          800: "#1A1625",
          900: "#0E0B14",
        },
        pearl: {
          DEFAULT: "#F8F6F3",
          warm: "#F0ECE6",
        },
        champagne: {
          DEFAULT: "#C4A882",
          light: "#E8D5BC",
          dark: "#A08660",
        },
        prism: {
          DEFAULT: "#7B61FF",
          light: "#A78BFA",
          dark: "#5B45CC",
        },
        "glass-teal": {
          DEFAULT: "#3ECFCF",
          light: "#6EE7E7",
          dark: "#2A9494",
        },
        rose: {
          DEFAULT: "#E8A0BF",
          light: "#F5D0E0",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        pill: "100px",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
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
        bloom: {
          "0%": { opacity: "0", filter: "blur(20px) brightness(1.5)", transform: "scale(0.95)" },
          "60%": { opacity: "1", filter: "blur(4px) brightness(1.1)", transform: "scale(1.01)" },
          "100%": { opacity: "1", filter: "blur(0) brightness(1)", transform: "scale(1)" },
        },
        "spring-in": {
          "0%": { opacity: "0", transform: "scale(0.9) translateY(8px)" },
          "60%": { transform: "scale(1.02) translateY(-2px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        bloom: "bloom 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "spring-in": "spring-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "fade-up": "fade-up 0.4s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
