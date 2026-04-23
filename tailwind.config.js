/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#111827",
          secondary: "#374151",
          accent: "#F59E0B"
        },
        background: "#F9FAFB",
        surface: "#FFFFFF",
        surfaceSubtle: "#F3F4F6",
        text: "#111827",
        textMuted: "#6B7280",
        border: "#E5E7EB",
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#DC2626",
        focus: "#F59E0B",
        hover: "#D97706"
      },
      fontFamily: {
        heading: ["Inter", "sans-serif"],
        body: ["Inter", "sans-serif"]
      },
      fontSize: {
        h1: ["26px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        h2: ["20px", { lineHeight: "1.3", fontWeight: "600" }],
        h3: ["16px", { lineHeight: "1.4", fontWeight: "600" }],
        body: ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        small: ["12px", { lineHeight: "1.4", fontWeight: "500" }]
      },
      spacing: {
        1: "8px",
        2: "16px",
        3: "24px",
        4: "32px",
        6: "48px"
      },
      borderRadius: {
        sm: "2px",
        md: "6px"
      },
      boxShadow: {
        subtle: "0 1px 3px rgba(0,0,0,0.08)"
      },
      maxWidth: {
        layout: "1200px"
      }
    }
  },
  plugins: []
};
