/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        tmf: {
          green: "#8CFF00",
          "green-hover": "#7CE000",
          "green-muted": "rgba(140, 255, 0, 0.12)",
          "green-glow": "rgba(140, 255, 0, 0.35)",
          black: "#000000",
          dark: "#060709",
          card: "#0C0E14",
          "card-hover": "#11151F",
          border: "#1C212E",
          "border-light": "#283042",
          muted: "#7E8695",
          text: "#F8FAFC",
        },
      },
      boxShadow: {
        glow: "0 0 25px rgba(140, 255, 0, 0.15)",
        "glow-lg": "0 0 45px rgba(140, 255, 0, 0.25)",
      },
    },
  },
  plugins: [],
};
