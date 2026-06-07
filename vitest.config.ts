import path, { resolve } from 'node:path'
import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [solid({ hot: !process.env.VITEST })],
  resolve: {
    alias: {
      '@solid-primitive/web': path.resolve(import.meta.dirname, 'packages/web/src'),
      '@solid-primitive/shared': path.resolve(import.meta.dirname, 'packages/shared/src'),
      '@solid-primitive/map': path.resolve(import.meta.dirname, 'packages/map/src'),
      '@solid-primitive/set': path.resolve(import.meta.dirname, 'packages/set/src'),
      '@solid-primitive/trigger': path.resolve(import.meta.dirname, 'packages/trigger/src'),
      '@solid-primitive/utils': path.resolve(import.meta.dirname, 'packages/utils/src'),
    },
    dedupe: ['solid-js'],
  },
  cacheDir: resolve(import.meta.dirname, 'node_modules/.vite'),
  test: {
    reporters: 'dot',
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      include: ['packages/**/*.{ts,tsx}'],
      exclude: ['**/.test/**', '**/dist/**', '**/types.ts', '**/*.config.{ts,tsx}'],
    },
    projects: [
      'packages/*/vitest.config.ts',
      {
        extends: './vitest.config.ts',
        test: {
          name: 'unit',
          environment: 'jsdom',
          setupFiles: [resolve(import.meta.dirname, 'packages/.test/setup.ts')],
          include: ['packages/**/*.{test,spec}.{ts,tsx}', 'test/*.{test,spec}.{ts,tsx}'],
          exclude: ['packages/**/*.{browser,server}.{test,spec}.{ts,tsx}'],
          server: {
            deps: {
              inline: ['solid-js'],
            },
          },
        },
      },
    ],
  },
})
