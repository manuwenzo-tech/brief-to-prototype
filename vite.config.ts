import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import assist from "./api/assist.ts";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "OPENAI_");
  for (const name of ["OPENAI_API_KEY", "OPENAI_MODEL"]) {
    if (env[name]) process.env[name] ??= env[name];
  }
  return {
    plugins: [
      react(),
      {
        name: "brief-api",
        configureServer(server) { server.middlewares.use("/api/assist", assist); },
        configurePreviewServer(server) { server.middlewares.use("/api/assist", assist); },
      },
    ],
  };
});
