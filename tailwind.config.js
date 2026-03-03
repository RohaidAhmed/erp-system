/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#e0e9ff",
          200: "#c7d5fe",
          300: "#a5b8fc",
          400: "#8194f8",
          500: "#6471f1",
          600: "#4f52e5",
          700: "#4240ca",
          800: "#3737a3",
          900: "#323481",
          950: "#1e1e4b",
        },
        surface: {
          DEFAULT: "#f8f9fc",
          50: "#ffffff",
          100: "#f8f9fc",
          200: "#f1f3f8",
          300: "#e4e8f0",
          400: "#c8d0e0",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        "card-hover": "0 4px 12px 0 rgb(0 0 0 / 0.10), 0 2px 4px -1px rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
};
