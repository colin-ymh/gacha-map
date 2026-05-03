/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#e94b8c",
        "primary-hover": "#d43a7a",
        "primary-bg": "#fce8f1",
        brand: "#e63946",
        "brand-hover": "#c92d39",
      },
    },
  },
  plugins: [],
};
