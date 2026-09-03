/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "var(--brand)",
        "brand-dark": "var(--brand-dark)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "#e5e7eb",
        muted: "var(--muted)",
        primary: "#10b981",
        "text-primary": "var(--text-primary)",
      },
    },
  },
  plugins: [],
}
