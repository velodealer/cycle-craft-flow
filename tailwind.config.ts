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
        "2xl": "1120px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Bricolage Grotesque"', '"IBM Plex Sans"', "ui-sans-serif", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        board: "hsl(var(--board))",
        panel: {
          DEFAULT: "hsl(var(--panel))",
          high: "hsl(var(--panel-high))",
        },
        line: "hsl(var(--line))",
        chalk: {
          DEFAULT: "hsl(var(--chalk))",
          dim: "hsl(var(--chalk-dim))",
        },
        amber: {
          DEFAULT: "hsl(var(--amber))",
          tint: "hsl(var(--amber-tint))",
        },
        gain: "hsl(var(--gain))",
        loss: "hsl(var(--loss))",
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
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 1px)",
        sm: "calc(var(--radius) - 2px)",
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
        "flap-flip": {
          "0%": { transform: "rotateX(0deg)" },
          "49%": { transform: "rotateX(90deg)", backgroundColor: "hsl(var(--amber))", color: "hsl(var(--board))" },
          "51%": { transform: "rotateX(-90deg)", backgroundColor: "hsl(var(--amber))", color: "hsl(var(--board))" },
          "100%": { transform: "rotateX(0deg)" },
        },
        "stat-tick": {
          from: { opacity: "0.4", transform: "translateY(2px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.15s ease-out",
        "accordion-up": "accordion-up 0.15s ease-out",
        "flap-flip": "flap-flip 300ms ease-in-out",
        "stat-tick": "stat-tick 400ms ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
