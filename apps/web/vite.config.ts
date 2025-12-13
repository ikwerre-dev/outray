import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tanstackStart(),
    nitro(),
    viteReact(),
    tailwindcss(),
  ],
  server: {
    allowedHosts: true,
  },
});
