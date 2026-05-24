import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bubble: {
          in: "#e5e7eb",
          out: "#3b82f6",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
