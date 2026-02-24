import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    globals: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: '50%',
        minForks: 1,
        isolate: true,
        singleFork: false,
      },
    },
    include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**', '**/.next/**', '**/test/helpers/**'],
    transformMode: {
      web: [/\.[jt]sx?$/],
      ssr: [/\.ts$/],
    },
    coverage: {
      provider: 'v8',
      enabled: false,
      include: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
      exclude: [
        'coverage/**',
        'dist/**',
        'node_modules/**',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/test/**',
        '**/*.test.{js,ts}',
        '**/*.spec.{js,ts}',
      ],
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        perFile: true,
      },
      clean: true,
      cleanOnRerun: true,
      reportOnFailure: true,
      skipFull: false,
      allowExternal: false,
    },
    sequence: {
      shuffle: false,
      concurrent: false,
      seed: Date.now(),
      hooks: 'stack',
    },
    maxConcurrency: 5,
    slowTestThreshold: 300,
    fileParallelism: true,
    maxWorkers: '50%',
    minWorkers: 1,
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './test-results/junit.xml',
    },
    chaiConfig: {
      includeStack: false,
      showDiff: true,
      truncateThreshold: 100,
    },
    diff: {
      aIndicator: '--',
      bIndicator: '++',
      omitAnnotationLines: true,
    },
    css: {
      include: [],
      exclude: [],
      modules: {
        classNameStrategy: 'stable',
      },
    },
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: ['effect', 'three'],
        },
      },
      external: [/node_modules/],
      inline: ['effect', 'three'],
    },
    server: {
      sourcemap: 'inline',
      debug: {
        dumpModules: false,
        loadDumppedModules: false,
      },
      hmr: {
        port: 24678,
      },
      fs: {
        allow: ['..'],
      },
    },
    typecheck: {
      enabled: false,
      only: false,
      checker: 'tsc',
      include: ['**/*.{test,spec}-d.?(c|m)[jt]s?(x)'],
      exclude: ['**/node_modules/**'],
      allowJs: false,
      ignoreSourceErrors: false,
      tsconfig: './tsconfig.json',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@test': resolve(__dirname, 'test'),
    },
  },
  plugins: [],
  define: {
    __TEST__: true,
    __DEV__: true,
    __NODE_VERSION__: JSON.stringify(process.version),
  },
  esbuild: {
    target: 'node22',
    format: 'esm',
    platform: 'node',
  },
})
