import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
      output: {
        entryFileNames: "index.js",
        chunkFileNames: "[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) {
            return "index.css";
          }
          return "[name][extname]";
        },
      },
    },
    // Minify for production
    minify: true,
    // Generate source maps for debugging
    sourcemap: true,
  },
  // Resolve paths for the components directory
  resolve: {
    alias: {
      "@components": resolve(__dirname, "../components"),
    },
  },
});
