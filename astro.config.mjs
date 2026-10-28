import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://herokeyvn.github.io",
  output: "static",
  build: {
    assets: "assets",
  },
});
