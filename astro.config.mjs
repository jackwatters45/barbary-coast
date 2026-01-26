import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://barbarycoastlax.com", // Update when domain is set
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
