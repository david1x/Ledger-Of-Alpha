import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "md:col-span-1", "md:col-span-2", "md:col-span-3",
    "md:col-span-4", "md:col-span-5", "md:col-span-6",
  ],
  theme: {
    extend: {
      colors: {
        profit: "#22c55e",
        loss: "#ef4444",
        neutral: "#94a3b8",
      },
    },
  },
  plugins: [],
};

export default config;
