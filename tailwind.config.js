/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0b0d10",
          card: "#13161b",
          hover: "#1a1e25",
          border: "#242932",
        },
        brand: {
          50: "#eef7ff",
          100: "#d8eaff",
          200: "#b9d9ff",
          300: "#8abfff",
          400: "#549aff",
          500: "#2b73ff",
          600: "#1a54f0",
          700: "#163fd1",
          800: "#1737a8",
          900: "#1a3584",
        },
        positive: "#22c55e",
        negative: "#ef4444",
        warning: "#f59e0b",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
