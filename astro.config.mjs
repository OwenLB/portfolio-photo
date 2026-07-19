import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import tailwind from '@astrojs/tailwind';
import netlify from '@astrojs/netlify';

export default defineConfig({
  output: 'hybrid',
  adapter: netlify(),
  integrations: [
    vue(),
    tailwind({ applyBaseStyles: false }),
  ],
});
