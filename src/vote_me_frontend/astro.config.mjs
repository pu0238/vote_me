import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import vue from "@astrojs/vue";

import singleFile from "astro-single-file";

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), vue(), singleFile()]
});