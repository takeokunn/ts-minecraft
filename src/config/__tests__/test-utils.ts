import { Effect, TestClock, TestContext, Layer, Context, Ref } from 'effect'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Test utilities for config module testing
 */

// Mock environment types
export interface MockEnvironment {
  NODE_ENV: string
  MODE: string
  [key: string]: string
}

// Test configuration factory
export const createTestConfig = <T>(partial: Partial<T>, defaults: T): T => ({
  ...defaults,
  ...partial,
})

// Mock environment provider
export const mockEnvironment = (env: MockEnvironment) => 
  Layer.succeed(
    Context.Tag<MockEnvironment>(),
    env
  )

// Common test environments
export const TestEnvironments = {
  development: mockEnvironment({
    NODE_ENV: 'development',
    MODE: 'development',
  }),
  production: mockEnvironment({
    NODE_ENV: 'production',
    MODE: 'production',
  }),
  test: mockEnvironment({
    NODE_ENV: 'test',
    MODE: 'test',
  }),
}

// Mock storage service
export class MockStorageService extends Context.Tag('MockStorageService')<
  MockStorageService,
  {
    readonly get: (key: string) => Effect.Effect<unknown>
    readonly set: (key: string, value: unknown) => Effect.Effect<void>
    readonly clear: Effect.Effect<void>
    readonly remove: (key: string) => Effect.Effect<void>
  }
>() {}

export const MockStorageServiceLive = Layer.effect(
  MockStorageService,
  Effect.gen(function* () {
    const storage = yield* Ref.make<Record<string, unknown>>({})
    
    return {
      get: (key: string) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(storage)
          return store[key]
        }),
      set: (key: string, value: unknown) =>
        Effect.gen(function* () {
          yield* Ref.update(storage, (store) => ({ ...store, [key]: value }))
        }),
      clear: Ref.set(storage, {}),
      remove: (key: string) =>
        Effect.gen(function* () {
          yield* Ref.update(storage, (store) => {
            const newStore = { ...store }
            delete newStore[key]
            return newStore
          })
        }),
    }
  })
)

// Mock browser APIs
export const mockBrowserAPIs = () => {
  // Mock localStorage
  const mockStorage = new Map<string, string>()
  Object.defineProperty(global, 'localStorage', {
    value: {
      getItem: vi.fn((key: string) => mockStorage.get(key) || null),
      setItem: vi.fn((key: string, value: string) => mockStorage.set(key, value)),
      removeItem: vi.fn((key: string) => mockStorage.delete(key)),
      clear: vi.fn(() => mockStorage.clear()),
    },
    writable: true,
  })

  // Mock navigator
  Object.defineProperty(global, 'navigator', {
    value: {
      hardwareConcurrency: 4,
      deviceMemory: 8,
      gpu: {},
    },
    writable: true,
  })

  // Mock document
  Object.defineProperty(global, 'document', {
    value: {
      createElement: vi.fn(() => ({
        getContext: vi.fn(() => ({})),
      })),
    },
    writable: true,
  })

  // Mock SharedArrayBuffer
  Object.defineProperty(global, 'SharedArrayBuffer', {
    value: class MockSharedArrayBuffer {},
    writable: true,
  })

  // Mock Worker
  Object.defineProperty(global, 'Worker', {
    value: class MockWorker {},
    writable: true,
  })

  return {
    cleanupMocks: () => {
      mockStorage.clear()
      vi.clearAllMocks()
    }
  }
}

// Test helpers for async effects
export const runEffectTest = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(effect)

export const runEffectTestExit = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromiseExit(effect)

// Schema validation test helpers
export const expectValidationSuccess = <A>(result: unknown): asserts result is A => {
  expect(result).toBeDefined()
}

export const expectValidationError = (result: unknown, expectedMessage?: string): void => {
  expect(result).toBeInstanceOf(Error)
  if (expectedMessage) {
    expect((result as Error).message).toContain(expectedMessage)
  }
}

// Configuration test factories
export const createValidAppConfig = () => ({
  appName: 'Test Minecraft',
  version: '1.0.0-test',
  debug: true,
  environment: 'test' as const,
  apiUrl: 'http://test.example.com',
  logging: {
    level: 'debug' as const,
    enableConsole: true,
    enableRemote: false,
  },
  features: {
    enableMultiplayer: false,
    enableWebGPU: false,
    enableWasm: true,
    enableServiceWorker: false,
    enableHotReload: false,
  },
  storage: {
    enableLocalStorage: true,
    enableIndexedDB: false,
    maxCacheSize: 100,
  },
  security: {
    enableCSP: false,
    allowedOrigins: ['*'],
  },
})

export const createValidGameConfig = () => ({
  world: {
    seed: 12345,
    chunkSize: 16,
    renderDistance: 8,
    maxLoadedChunks: 50,
    worldHeight: 256,
    seaLevel: 64,
    generateCaves: true,
    generateOres: true,
    generateStructures: true,
  },
  player: {
    defaultGameMode: 'creative' as const,
    spawnPosition: { x: 0, y: 70, z: 0 },
    respawnPosition: { x: 0, y: 70, z: 0 },
    allowFlying: true,
    movementSpeed: 4.317,
    jumpForce: 0.42,
    maxHealth: 20,
    maxHunger: 20,
  },
  physics: {
    gravity: 9.8,
    friction: 0.98,
    airResistance: 0.02,
    waterResistance: 0.8,
    enableCollision: true,
    enableGravity: true,
  },
  gameplay: {
    difficulty: 'normal' as const,
    enableDayNightCycle: true,
    dayLength: 1200000,
    enableWeather: true,
    enableMobs: false,
    enableHunger: false,
    keepInventory: true,
  },
  performance: {
    targetFPS: 60,
    vSync: true,
    lodEnabled: true,
    frustumCulling: true,
    occlusionCulling: false,
    shadowsEnabled: true,
    particlesEnabled: true,
    maxParticles: 1000,
  },
  graphics: {
    renderDistance: 8,
    fieldOfView: 75,
    brightness: 1.0,
    contrast: 1.0,
    saturation: 1.0,
    antiAliasing: true,
    textureFiltering: 'linear' as const,
    mipmapping: true,
  },
  audio: {
    masterVolume: 1.0,
    soundVolume: 0.8,
    musicVolume: 0.6,
    ambientVolume: 0.7,
    enableSpatialAudio: true,
  },
  controls: {
    mouseSensitivity: 1.0,
    invertMouseY: false,
    keyBindings: {
      forward: 'KeyW',
      backward: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      jump: 'Space',
      sneak: 'ShiftLeft',
      sprint: 'ControlLeft',
      inventory: 'KeyE',
      chat: 'KeyT',
      debug: 'F3',
    },
  },
})

export const createValidInfrastructureConfig = () => ({
  rendering: {
    engine: 'three' as const,
    preferWebGPU: false,
    canvas: {
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance' as const,
      preserveDrawingBuffer: false,
    },
    webgl: {
      contextAttributes: {
        antialias: true,
        alpha: false,
        depth: true,
        stencil: false,
        preserveDrawingBuffer: false,
      },
    },
    webgpu: {
      preferredFormat: 'bgra8unorm' as const,
      powerPreference: 'high-performance' as const,
    },
  },
  memory: {
    maxHeapSize: 512,
    gcThreshold: 0.8,
    objectPoolSize: 5000,
    texturePoolSize: 50,
    geometryPoolSize: 250,
  },
  workers: {
    maxWorkers: 2,
    useWorkers: false,
    workerScripts: {
      terrain: '/workers/terrain-generation.worker.js',
      physics: '/workers/physics.worker.js',
      compute: '/workers/computation.worker.js',
    },
    timeout: 5000,
  },
  network: {
    enableMultiplayer: false,
    websocket: {
      reconnectAttempts: 3,
      reconnectInterval: 1000,
      timeout: 3000,
    },
    http: {
      timeout: 5000,
      retries: 2,
      retryDelay: 500,
    },
  },
  storage: {
    provider: 'localStorage' as const,
    compression: false,
    encryption: false,
    maxSize: 100,
    cacheTTL: 3600000,
  },
  monitoring: {
    enabled: false,
    sampleRate: 0.1,
    maxSamples: 100,
    enableGPUTiming: false,
    enableMemoryProfiling: false,
    enableNetworkProfiling: false,
  },
  development: {
    enableDebugger: false,
    enableProfiler: false,
    enableHotReload: false,
    enableSourceMaps: false,
    logLevel: 'error' as const,
  },
  assets: {
    baseUrl: '/assets',
    textureAtlasSize: 512,
    compressionFormat: 'none' as const,
    loadingStrategy: 'eager' as const,
    cacheStrategy: 'memory' as const,
  },
  audio: {
    context: 'web-audio' as const,
    sampleRate: 44100,
    bufferSize: 2048,
    maxSources: 32,
    enableCompression: false,
    spatialAudio: {
      enabled: false,
      algorithm: 'panner' as const,
      distanceModel: 'linear' as const,
    },
  },
  security: {
    contentSecurityPolicy: false,
    crossOriginIsolation: false,
    sharedArrayBuffer: false,
    trustedTypes: false,
  },
})

// Helper to run test with cleanup
export const withTestEnvironment = <A, E>(
  test: Effect.Effect<A, E>,
  environment: Layer.Layer<any> = TestEnvironments.test
) => {
  const { cleanupMocks } = mockBrowserAPIs()
  
  return Effect.gen(function* () {
    try {
      return yield* test
    } finally {
      cleanupMocks()
    }
  }).pipe(Effect.provide(environment))
}