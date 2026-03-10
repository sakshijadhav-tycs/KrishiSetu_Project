import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const apiUrl = env.VITE_API_URL || "http://localhost:5000/api";
  const target = apiUrl.replace(/\/api\/?$/, "");

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
        },
      },
    },
  };
});
