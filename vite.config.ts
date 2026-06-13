import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  // './' base ensures the dist/ output works when opened from the filesystem
  // or deployed to a sub-directory (e.g. GitHub Pages).
  base: "./",

  resolve: {
    alias: {
      // Keep in sync with tsconfig.json paths
      "@scenes": path.resolve(__dirname, "src/scenes"),
      "@entities": path.resolve(__dirname, "src/entities"),
      "@systems": path.resolve(__dirname, "src/systems"),
      "@config": path.resolve(__dirname, "src/config"),
    },
  },

  // Tell Vite to treat .tmj (Tiled map JSON) files as static assets
  // so they can be loaded via this.load.tilemapTiledJSON() at runtime.
  assetsInclude: ["**/*.tmj"],

  server: {
    port: 8080,
    open: true, // Auto-open browser on dev start
  },

  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        // Keep Phaser in its own chunk for better caching.
        // Vite 8 (Rolldown) requires manualChunks as a function, not an object.
        manualChunks: (id: string) => {
          if (id.includes("node_modules/phaser")) return "phaser";
          return undefined;
        },
      },
    },
  },
});
