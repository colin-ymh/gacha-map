/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#6C47FF",
        "primary-hover": "#5535E0",
        "primary-bg": "#F0EDFF",
      },
    },
  },
  plugins: [],
};
