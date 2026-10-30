import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Vite 配置：React + Tailwind v4（通过官方 Vite 插件，无需 postcss 配置文件）
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
});
