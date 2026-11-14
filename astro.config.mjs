// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// SITE and BASE come from the deploy workflow (GitHub Pages serves a project
// repo from /<repo-name>/). Locally and on a real domain they fall back to the
// defaults below. Replace the default with the real domain before going live
// (also in profile.yaml → seo.siteUrl).
export default defineConfig({
  site: process.env.SITE || 'https://geletaaddis.com',
  base: process.env.BASE || '/',
  integrations: [sitemap()],
  build: { inlineStylesheets: 'auto' },
  prefetch: false,
});
