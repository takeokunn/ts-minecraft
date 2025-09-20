/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@config': resolve(__dirname, './src/config'),
      '@docs': resolve(__dirname, './docs'),
    },
  },
  server: {
    port: 3000,
    host: true,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
    minify: 'esbuild',
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [],
    testTimeout: 1000,
  },
})
