import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const backendTarget = process.env.VITE_DEV_BACKEND_URL || "http://localhost:8080";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/auth": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/riders": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/drivers": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/admin": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/actuator": {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
});
