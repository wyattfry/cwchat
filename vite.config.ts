import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Keep built assets relative so the site works at /cwchat/ on GitHub Pages.
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
