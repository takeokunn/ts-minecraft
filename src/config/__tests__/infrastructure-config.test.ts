import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import * as S from 'effect/Schema'
import {
  InfrastructureConfigSchema,
  RenderingConfigSchema,
  MemoryConfigSchema,
  WorkerConfigSchema,
  NetworkConfigSchema,
  StorageConfigSchema,
  MonitoringConfigSchema,
  DevelopmentConfigSchema,
  AssetConfigSchema,
  AudioConfigSchema,
  SecurityConfigSchema,
  WebGLContextAttributesSchema,
  CanvasConfigSchema,
  WebGPUConfigSchema,
  SpatialAudioConfigSchema,
  defaultInfrastructureConfig,
  defaultRenderingConfig,
  defaultMemoryConfig,
  defaultWorkerConfig,
  defaultNetworkConfig,
  defaultStorageConfig,
  defaultMonitoringConfig,
  defaultDevelopmentConfig,
  defaultAssetConfig,
  defaultAudioConfig,
  defaultSecurityConfig,
  type InfrastructureConfig,
  type RenderingConfig,
  type MemoryConfig,
  type WorkerConfig,
  type NetworkConfig,
  type StorageConfig,
  type MonitoringConfig,
  type DevelopmentConfig,
  type AssetConfig,
  type AudioConfig,
  type SecurityConfig,
} from '../schemas/infrastructure.schema'
import {
  INFRASTRUCTURE_CONFIG,
} from '../infrastructure-config'


describe('InfrastructureConfig Schemas', () => {

  describe('WebGLContextAttributesSchema', () => {
    it('should validate correct WebGL context attributes', async () => {
      const validAttributes = {
        antialias: true,
        alpha: false,
        depth: true,
        stencil: false,
        preserveDrawingBuffer: false,
      }

      const result = await Effect.runPromise(S.decodeUnknown(WebGLContextAttributesSchema)(validAttributes))
      expect(result).toEqual(validAttributes)
    })

    it('should reject non-boolean values', async () => {
      const invalidAttributes = [
        { antialias: 'true', alpha: false, depth: true, stencil: false, preserveDrawingBuffer: false },
        { antialias: true, alpha: 0, depth: true, stencil: false, preserveDrawingBuffer: false },
        { antialias: true, alpha: false, depth: 1, stencil: false, preserveDrawingBuffer: false },
      ]

      for (const attrs of invalidAttributes) {
        await expect(
          Effect.runPromise(S.decodeUnknown(WebGLContextAttributesSchema)(attrs))
        ).rejects.toThrow()
      }
    })

    it('should reject missing required attributes', async () => {
      const incompleteAttributes = [
        { antialias: true }, // missing other attributes
        { antialias: true, alpha: false }, // missing depth, stencil, preserveDrawingBuffer
        {}, // empty object
      ]

      for (const attrs of incompleteAttributes) {
        await expect(
          Effect.runPromise(S.decodeUnknown(WebGLContextAttributesSchema)(attrs))
        ).rejects.toThrow()
      }
    })
  })

  describe('CanvasConfigSchema', () => {
    it('should validate correct canvas configuration', async () => {
      const validConfig = {
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance' as const,
        preserveDrawingBuffer: false,
      }

      const result = await Effect.runPromise(S.decodeUnknown(CanvasConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should accept all valid power preference values', async () => {
      const powerPreferences = ['default', 'high-performance', 'low-power'] as const
      
      for (const powerPreference of powerPreferences) {
        const config = {
          antialias: true,
          alpha: false,
          powerPreference,
          preserveDrawingBuffer: false,
        }
        
        const result = await Effect.runPromise(S.decodeUnknown(CanvasConfigSchema)(config))
        expect(result.powerPreference).toBe(powerPreference)
      }
    })

    it('should reject invalid power preference values', async () => {
      const invalidConfig = {
        antialias: true,
        alpha: false,
        powerPreference: 'ultra-performance',
        preserveDrawingBuffer: false,
      }

      await expect(
        Effect.runPromise(S.decodeUnknown(CanvasConfigSchema)(invalidConfig))
      ).rejects.toThrow()
    })
  })

  describe('WebGPUConfigSchema', () => {
    it('should validate correct WebGPU configuration', async () => {
      const validConfig = {
        preferredFormat: 'bgra8unorm' as const,
        powerPreference: 'high-performance' as const,
      }

      const result = await Effect.runPromise(S.decodeUnknown(WebGPUConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should accept all valid preferred formats', async () => {
      const formats = ['bgra8unorm', 'rgba8unorm'] as const
      
      for (const preferredFormat of formats) {
        const config = {
          preferredFormat,
          powerPreference: 'high-performance' as const,
        }
        
        const result = await Effect.runPromise(S.decodeUnknown(WebGPUConfigSchema)(config))
        expect(result.preferredFormat).toBe(preferredFormat)
      }
    })

    it('should accept all valid WebGPU power preferences', async () => {
      const powerPreferences = ['low-power', 'high-performance'] as const
      
      for (const powerPreference of powerPreferences) {
        const config = {
          preferredFormat: 'bgra8unorm' as const,
          powerPreference,
        }
        
        const result = await Effect.runPromise(S.decodeUnknown(WebGPUConfigSchema)(config))
        expect(result.powerPreference).toBe(powerPreference)
      }
    })

    it('should reject invalid format or power preference', async () => {
      const invalidConfigs = [
        { preferredFormat: 'rgba16float', powerPreference: 'high-performance' },
        { preferredFormat: 'bgra8unorm', powerPreference: 'default' },
      ]

      for (const config of invalidConfigs) {
        await expect(
          Effect.runPromise(S.decodeUnknown(WebGPUConfigSchema)(config))
        ).rejects.toThrow()
      }
    })
  })

  describe('RenderingConfigSchema', () => {
    it('should validate complete rendering configuration', async () => {
      const validConfig: RenderingConfig = {
        engine: 'three',
        preferWebGPU: true,
        canvas: {
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
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
          preferredFormat: 'bgra8unorm',
          powerPreference: 'high-performance',
        },
      }

      const result = await Effect.runPromise(S.decodeUnknown(RenderingConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should accept all valid rendering engines', async () => {
      const engines = ['three', 'webgpu'] as const
      
      for (const engine of engines) {
        const config = { ...defaultRenderingConfig, engine }
        const result = await Effect.runPromise(S.decodeUnknown(RenderingConfigSchema)(config))
        expect(result.engine).toBe(engine)
      }
    })
  })

  describe('MemoryConfigSchema', () => {
    it('should validate correct memory configuration', async () => {
      const validConfig: MemoryConfig = {
        maxHeapSize: 1024,
        gcThreshold: 0.8,
        objectPoolSize: 10000,
        texturePoolSize: 100,
        geometryPoolSize: 500,
      }

      const result = await Effect.runPromise(S.decodeUnknown(MemoryConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should validate GC threshold bounds', async () => {
      const validThresholds = [0.1, 0.5, 0.8, 0.9, 0.95]
      const invalidThresholds = [0.09, 0.96, 1.0, 1.1, -0.1]
      
      for (const threshold of validThresholds) {
        const config = { ...defaultMemoryConfig, gcThreshold: threshold }
        const result = await Effect.runPromise(S.decodeUnknown(MemoryConfigSchema)(config))
        expect(result.gcThreshold).toBe(threshold)
      }
      
      for (const threshold of invalidThresholds) {
        const config = { ...defaultMemoryConfig, gcThreshold: threshold }
        await expect(
          Effect.runPromise(S.decodeUnknown(MemoryConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should validate pool size bounds', async () => {
      // Object pool: 1000-100000
      const validObjectPoolSizes = [1000, 10000, 50000, 100000]
      const invalidObjectPoolSizes = [999, 100001, 0, -1000]
      
      for (const size of validObjectPoolSizes) {
        const config = { ...defaultMemoryConfig, objectPoolSize: size }
        const result = await Effect.runPromise(S.decodeUnknown(MemoryConfigSchema)(config))
        expect(result.objectPoolSize).toBe(size)
      }
      
      for (const size of invalidObjectPoolSizes) {
        const config = { ...defaultMemoryConfig, objectPoolSize: size }
        await expect(
          Effect.runPromise(S.decodeUnknown(MemoryConfigSchema)(config))
        ).rejects.toThrow()
      }

      // Texture pool: 10-1000
      const validTexturePoolSizes = [10, 100, 500, 1000]
      const invalidTexturePoolSizes = [9, 1001, 0, -10]
      
      for (const size of validTexturePoolSizes) {
        const config = { ...defaultMemoryConfig, texturePoolSize: size }
        const result = await Effect.runPromise(S.decodeUnknown(MemoryConfigSchema)(config))
        expect(result.texturePoolSize).toBe(size)
      }
      
      for (const size of invalidTexturePoolSizes) {
        const config = { ...defaultMemoryConfig, texturePoolSize: size }
        await expect(
          Effect.runPromise(S.decodeUnknown(MemoryConfigSchema)(config))
        ).rejects.toThrow()
      }

      // Geometry pool: 100-10000
      const validGeometryPoolSizes = [100, 500, 5000, 10000]
      const invalidGeometryPoolSizes = [99, 10001, 0, -100]
      
      for (const size of validGeometryPoolSizes) {
        const config = { ...defaultMemoryConfig, geometryPoolSize: size }
        const result = await Effect.runPromise(S.decodeUnknown(MemoryConfigSchema)(config))
        expect(result.geometryPoolSize).toBe(size)
      }
      
      for (const size of invalidGeometryPoolSizes) {
        const config = { ...defaultMemoryConfig, geometryPoolSize: size }
        await expect(
          Effect.runPromise(S.decodeUnknown(MemoryConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should require positive heap size', async () => {
      const invalidHeapSizes = [0, -1, -100]
      
      for (const size of invalidHeapSizes) {
        const config = { ...defaultMemoryConfig, maxHeapSize: size }
        await expect(
          Effect.runPromise(S.decodeUnknown(MemoryConfigSchema)(config))
        ).rejects.toThrow()
      }
    })
  })

  describe('WorkerConfigSchema', () => {
    it('should validate correct worker configuration', async () => {
      const validConfig: WorkerConfig = {
        maxWorkers: 4,
        useWorkers: true,
        workerScripts: {
          terrain: '/workers/terrain-generation.worker.js',
          physics: '/workers/physics.worker.js',
          compute: '/workers/computation.worker.js',
        },
        timeout: 10000,
      }

      const result = await Effect.runPromise(S.decodeUnknown(WorkerConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should validate max workers bounds (0-32)', async () => {
      const validWorkerCounts = [0, 1, 4, 16, 32]
      const invalidWorkerCounts = [-1, 33, 64, 100]
      
      for (const count of validWorkerCounts) {
        const config = { ...defaultWorkerConfig, maxWorkers: count }
        const result = await Effect.runPromise(S.decodeUnknown(WorkerConfigSchema)(config))
        expect(result.maxWorkers).toBe(count)
      }
      
      for (const count of invalidWorkerCounts) {
        const config = { ...defaultWorkerConfig, maxWorkers: count }
        await expect(
          Effect.runPromise(S.decodeUnknown(WorkerConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should require non-empty worker script paths', async () => {
      const invalidConfigs = [
        { ...defaultWorkerConfig, workerScripts: { ...defaultWorkerConfig.workerScripts, terrain: '' } },
        { ...defaultWorkerConfig, workerScripts: { ...defaultWorkerConfig.workerScripts, physics: '' } },
        { ...defaultWorkerConfig, workerScripts: { ...defaultWorkerConfig.workerScripts, compute: '' } },
      ]

      for (const config of invalidConfigs) {
        await expect(
          Effect.runPromise(S.decodeUnknown(WorkerConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should allow zero timeout (non-negative)', async () => {
      const validTimeouts = [0, 1000, 5000, 30000]
      
      for (const timeout of validTimeouts) {
        const config = { ...defaultWorkerConfig, timeout }
        const result = await Effect.runPromise(S.decodeUnknown(WorkerConfigSchema)(config))
        expect(result.timeout).toBe(timeout)
      }
    })
  })

  describe('NetworkConfigSchema', () => {
    it('should validate correct network configuration', async () => {
      const validConfig: NetworkConfig = {
        enableMultiplayer: false,
        websocket: {
          reconnectAttempts: 5,
          reconnectInterval: 1000,
          timeout: 5000,
        },
        http: {
          timeout: 10000,
          retries: 3,
          retryDelay: 1000,
        },
      }

      const result = await Effect.runPromise(S.decodeUnknown(NetworkConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should accept optional server URL', async () => {
      const configWithUrl = {
        ...defaultNetworkConfig,
        serverUrl: 'https://api.example.com',
      }
      
      const configWithoutUrl = {
        ...defaultNetworkConfig,
        // serverUrl is optional
      }
      
      const resultWith = await Effect.runPromise(S.decodeUnknown(NetworkConfigSchema)(configWithUrl))
      const resultWithout = await Effect.runPromise(S.decodeUnknown(NetworkConfigSchema)(configWithoutUrl))
      
      expect(resultWith.serverUrl).toBe('https://api.example.com')
      expect(resultWithout.serverUrl).toBeUndefined()
    })

    it('should validate retry attempts bounds (0-10)', async () => {
      const validAttempts = [0, 1, 5, 10]
      const invalidAttempts = [-1, 11, 20]
      
      for (const attempts of validAttempts) {
        const config = {
          ...defaultNetworkConfig,
          websocket: { ...defaultNetworkConfig.websocket, reconnectAttempts: attempts },
          http: { ...defaultNetworkConfig.http, retries: attempts },
        }
        
        const result = await Effect.runPromise(S.decodeUnknown(NetworkConfigSchema)(config))
        expect(result.websocket.reconnectAttempts).toBe(attempts)
        expect(result.http.retries).toBe(attempts)
      }
      
      for (const attempts of invalidAttempts) {
        const wsConfig = {
          ...defaultNetworkConfig,
          websocket: { ...defaultNetworkConfig.websocket, reconnectAttempts: attempts },
        }
        const httpConfig = {
          ...defaultNetworkConfig,
          http: { ...defaultNetworkConfig.http, retries: attempts },
        }
        
        await expect(
          Effect.runPromise(S.decodeUnknown(NetworkConfigSchema)(wsConfig))
        ).rejects.toThrow()
        
        await expect(
          Effect.runPromise(S.decodeUnknown(NetworkConfigSchema)(httpConfig))
        ).rejects.toThrow()
      }
    })

    it('should require positive durations for intervals and delays', async () => {
      const validDurations = [100, 1000, 5000, 30000]
      const invalidDurations = [0, -1, -1000] // DurationMs requires positive values
      
      for (const duration of validDurations) {
        const config = {
          ...defaultNetworkConfig,
          websocket: { 
            ...defaultNetworkConfig.websocket, 
            reconnectInterval: duration 
          },
          http: { 
            ...defaultNetworkConfig.http, 
            retryDelay: duration 
          },
        }
        
        const result = await Effect.runPromise(S.decodeUnknown(NetworkConfigSchema)(config))
        expect(result.websocket.reconnectInterval).toBe(duration)
        expect(result.http.retryDelay).toBe(duration)
      }
      
      for (const duration of invalidDurations) {
        const wsConfig = {
          ...defaultNetworkConfig,
          websocket: { ...defaultNetworkConfig.websocket, reconnectInterval: duration },
        }
        const httpConfig = {
          ...defaultNetworkConfig,
          http: { ...defaultNetworkConfig.http, retryDelay: duration },
        }
        
        await expect(
          Effect.runPromise(S.decodeUnknown(NetworkConfigSchema)(wsConfig))
        ).rejects.toThrow()
        
        await expect(
          Effect.runPromise(S.decodeUnknown(NetworkConfigSchema)(httpConfig))
        ).rejects.toThrow()
      }
    })
  })

  describe('StorageConfigSchema', () => {
    it('should validate correct storage configuration', async () => {
      const validConfig: StorageConfig = {
        provider: 'indexedDB',
        compression: true,
        encryption: false,
        maxSize: 500,
        cacheTTL: 86400000,
      }

      const result = await Effect.runPromise(S.decodeUnknown(StorageConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should accept all valid storage providers', async () => {
      const providers = ['localStorage', 'indexedDB', 'opfs'] as const
      
      for (const provider of providers) {
        const config = { ...defaultStorageConfig, provider }
        const result = await Effect.runPromise(S.decodeUnknown(StorageConfigSchema)(config))
        expect(result.provider).toBe(provider)
      }
    })

    it('should require positive max size and cache TTL', async () => {
      const validSizes = [100, 500, 1000, 2048]
      const invalidSizes = [0, -1, -100]
      
      for (const size of validSizes) {
        const config = { ...defaultStorageConfig, maxSize: size }
        const result = await Effect.runPromise(S.decodeUnknown(StorageConfigSchema)(config))
        expect(result.maxSize).toBe(size)
      }
      
      for (const size of invalidSizes) {
        const config = { ...defaultStorageConfig, maxSize: size }
        await expect(
          Effect.runPromise(S.decodeUnknown(StorageConfigSchema)(config))
        ).rejects.toThrow()
      }

      const validTTLs = [1000, 3600000, 86400000]
      const invalidTTLs = [0, -1, -3600000]
      
      for (const ttl of validTTLs) {
        const config = { ...defaultStorageConfig, cacheTTL: ttl }
        const result = await Effect.runPromise(S.decodeUnknown(StorageConfigSchema)(config))
        expect(result.cacheTTL).toBe(ttl)
      }
      
      for (const ttl of invalidTTLs) {
        const config = { ...defaultStorageConfig, cacheTTL: ttl }
        await expect(
          Effect.runPromise(S.decodeUnknown(StorageConfigSchema)(config))
        ).rejects.toThrow()
      }
    })
  })

  describe('MonitoringConfigSchema', () => {
    it('should validate correct monitoring configuration', async () => {
      const validConfig: MonitoringConfig = {
        enabled: true,
        sampleRate: 0.1,
        maxSamples: 1000,
        enableGPUTiming: true,
        enableMemoryProfiling: true,
        enableNetworkProfiling: false,
      }

      const result = await Effect.runPromise(S.decodeUnknown(MonitoringConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should validate sample rate bounds (0-1)', async () => {
      const validRates = [0, 0.1, 0.5, 1.0]
      const invalidRates = [-0.1, 1.1, 2.0]
      
      for (const rate of validRates) {
        const config = { ...defaultMonitoringConfig, sampleRate: rate }
        const result = await Effect.runPromise(S.decodeUnknown(MonitoringConfigSchema)(config))
        expect(result.sampleRate).toBe(rate)
      }
      
      for (const rate of invalidRates) {
        const config = { ...defaultMonitoringConfig, sampleRate: rate }
        await expect(
          Effect.runPromise(S.decodeUnknown(MonitoringConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should validate max samples bounds (100-10000)', async () => {
      const validSamples = [100, 1000, 5000, 10000]
      const invalidSamples = [99, 10001, 0, -100]
      
      for (const samples of validSamples) {
        const config = { ...defaultMonitoringConfig, maxSamples: samples }
        const result = await Effect.runPromise(S.decodeUnknown(MonitoringConfigSchema)(config))
        expect(result.maxSamples).toBe(samples)
      }
      
      for (const samples of invalidSamples) {
        const config = { ...defaultMonitoringConfig, maxSamples: samples }
        await expect(
          Effect.runPromise(S.decodeUnknown(MonitoringConfigSchema)(config))
        ).rejects.toThrow()
      }
    })
  })

  describe('AssetConfigSchema', () => {
    it('should validate correct asset configuration', async () => {
      const validConfig: AssetConfig = {
        baseUrl: '/assets',
        textureAtlasSize: 1024,
        compressionFormat: 'gzip',
        loadingStrategy: 'progressive',
        cacheStrategy: 'hybrid',
      }

      const result = await Effect.runPromise(S.decodeUnknown(AssetConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should validate texture atlas size is power of 2 and within bounds', async () => {
      const validSizes = [256, 512, 1024, 2048, 4096]
      const invalidSizes = [255, 300, 4097, 8192, 128] // last one is below 256
      
      for (const size of validSizes) {
        const config = { ...defaultAssetConfig, textureAtlasSize: size }
        const result = await Effect.runPromise(S.decodeUnknown(AssetConfigSchema)(config))
        expect(result.textureAtlasSize).toBe(size)
      }
      
      for (const size of invalidSizes) {
        const config = { ...defaultAssetConfig, textureAtlasSize: size }
        await expect(
          Effect.runPromise(S.decodeUnknown(AssetConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should accept all valid compression formats, loading strategies, and cache strategies', async () => {
      const compressionFormats = ['none', 'gzip', 'brotli'] as const
      const loadingStrategies = ['eager', 'lazy', 'progressive'] as const
      const cacheStrategies = ['memory', 'disk', 'hybrid'] as const
      
      for (const format of compressionFormats) {
        const config = { ...defaultAssetConfig, compressionFormat: format }
        const result = await Effect.runPromise(S.decodeUnknown(AssetConfigSchema)(config))
        expect(result.compressionFormat).toBe(format)
      }
      
      for (const strategy of loadingStrategies) {
        const config = { ...defaultAssetConfig, loadingStrategy: strategy }
        const result = await Effect.runPromise(S.decodeUnknown(AssetConfigSchema)(config))
        expect(result.loadingStrategy).toBe(strategy)
      }
      
      for (const strategy of cacheStrategies) {
        const config = { ...defaultAssetConfig, cacheStrategy: strategy }
        const result = await Effect.runPromise(S.decodeUnknown(AssetConfigSchema)(config))
        expect(result.cacheStrategy).toBe(strategy)
      }
    })

    it('should require non-empty base URL', async () => {
      const invalidConfig = { ...defaultAssetConfig, baseUrl: '' }
      
      await expect(
        Effect.runPromise(S.decodeUnknown(AssetConfigSchema)(invalidConfig))
      ).rejects.toThrow()
    })
  })

  describe('AudioConfigSchema', () => {
    it('should validate correct audio configuration', async () => {
      const validConfig: AudioConfig = {
        context: 'web-audio',
        sampleRate: 44100,
        bufferSize: 4096,
        maxSources: 64,
        enableCompression: true,
        spatialAudio: {
          enabled: true,
          algorithm: 'panner',
          distanceModel: 'inverse',
        },
      }

      const result = await Effect.runPromise(S.decodeUnknown(AudioConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should validate sample rate bounds (8000-96000)', async () => {
      const validRates = [8000, 22050, 44100, 48000, 96000]
      const invalidRates = [7999, 96001, 100000]
      
      for (const rate of validRates) {
        const config = { ...defaultAudioConfig, sampleRate: rate }
        const result = await Effect.runPromise(S.decodeUnknown(AudioConfigSchema)(config))
        expect(result.sampleRate).toBe(rate)
      }
      
      for (const rate of invalidRates) {
        const config = { ...defaultAudioConfig, sampleRate: rate }
        await expect(
          Effect.runPromise(S.decodeUnknown(AudioConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should validate buffer size is power of 2 within bounds (256-16384)', async () => {
      const validSizes = [256, 512, 1024, 2048, 4096, 8192, 16384]
      const invalidSizes = [255, 300, 16385, 32768, 128] // last one is below 256
      
      for (const size of validSizes) {
        const config = { ...defaultAudioConfig, bufferSize: size }
        const result = await Effect.runPromise(S.decodeUnknown(AudioConfigSchema)(config))
        expect(result.bufferSize).toBe(size)
      }
      
      for (const size of invalidSizes) {
        const config = { ...defaultAudioConfig, bufferSize: size }
        await expect(
          Effect.runPromise(S.decodeUnknown(AudioConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should validate max sources bounds (8-256)', async () => {
      const validSources = [8, 16, 32, 64, 128, 256]
      const invalidSources = [7, 257, 512, 0]
      
      for (const sources of validSources) {
        const config = { ...defaultAudioConfig, maxSources: sources }
        const result = await Effect.runPromise(S.decodeUnknown(AudioConfigSchema)(config))
        expect(result.maxSources).toBe(sources)
      }
      
      for (const sources of invalidSources) {
        const config = { ...defaultAudioConfig, maxSources: sources }
        await expect(
          Effect.runPromise(S.decodeUnknown(AudioConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should validate spatial audio configuration', async () => {
      const validSpatialConfigs = [
        { enabled: true, algorithm: 'panner' as const, distanceModel: 'linear' as const },
        { enabled: true, algorithm: 'hrtf' as const, distanceModel: 'inverse' as const },
        { enabled: false, algorithm: 'panner' as const, distanceModel: 'exponential' as const },
      ]
      
      for (const spatialAudio of validSpatialConfigs) {
        const config = { ...defaultAudioConfig, spatialAudio }
        const result = await Effect.runPromise(S.decodeUnknown(AudioConfigSchema)(config))
        expect(result.spatialAudio).toEqual(spatialAudio)
      }
    })

    it('should reject invalid spatial audio algorithms and distance models', async () => {
      const invalidConfigs = [
        { enabled: true, algorithm: 'binaural', distanceModel: 'linear' },
        { enabled: true, algorithm: 'panner', distanceModel: 'quadratic' },
      ]
      
      for (const spatialAudio of invalidConfigs) {
        const config = { ...defaultAudioConfig, spatialAudio }
        await expect(
          Effect.runPromise(S.decodeUnknown(AudioConfigSchema)(config))
        ).rejects.toThrow()
      }
    })
  })

  describe('InfrastructureConfigSchema (Complete)', () => {
    it('should validate complete infrastructure configuration', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(InfrastructureConfigSchema)(defaultInfrastructureConfig))
      expect(result).toEqual(defaultInfrastructureConfig)
    })

    it('should reject incomplete configuration', async () => {
      const incompleteConfigs = [
        { rendering: defaultRenderingConfig }, // missing other sections
        { rendering: defaultRenderingConfig, memory: defaultMemoryConfig }, // missing other sections
        {}, // empty object
      ]

      for (const config of incompleteConfigs) {
        await expect(
          Effect.runPromise(S.decodeUnknown(InfrastructureConfigSchema)(config))
        ).rejects.toThrow()
      }
    })
  })

  describe('Default Configurations', () => {
    it('should have valid default rendering config', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(RenderingConfigSchema)(defaultRenderingConfig))
      expect(result).toEqual(defaultRenderingConfig)
    })

    it('should have valid default memory config', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(MemoryConfigSchema)(defaultMemoryConfig))
      expect(result).toEqual(defaultMemoryConfig)
    })

    it('should have valid default worker config', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(WorkerConfigSchema)(defaultWorkerConfig))
      expect(result).toEqual(defaultWorkerConfig)
    })

    it('should have valid default network config', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(NetworkConfigSchema)(defaultNetworkConfig))
      expect(result).toEqual(defaultNetworkConfig)
    })

    it('should have valid default storage config', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(StorageConfigSchema)(defaultStorageConfig))
      expect(result).toEqual(defaultStorageConfig)
    })

    it('should have valid default monitoring config', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(MonitoringConfigSchema)(defaultMonitoringConfig))
      expect(result).toEqual(defaultMonitoringConfig)
    })

    it('should have valid default development config', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(DevelopmentConfigSchema)(defaultDevelopmentConfig))
      expect(result).toEqual(defaultDevelopmentConfig)
    })

    it('should have valid default asset config', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(AssetConfigSchema)(defaultAssetConfig))
      expect(result).toEqual(defaultAssetConfig)
      expect(defaultAssetConfig.textureAtlasSize & (defaultAssetConfig.textureAtlasSize - 1)).toBe(0) // power of 2 check
    })

    it('should have valid default audio config', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(AudioConfigSchema)(defaultAudioConfig))
      expect(result).toEqual(defaultAudioConfig)
      expect(defaultAudioConfig.bufferSize & (defaultAudioConfig.bufferSize - 1)).toBe(0) // power of 2 check
    })

    it('should have valid default security config', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(SecurityConfigSchema)(defaultSecurityConfig))
      expect(result).toEqual(defaultSecurityConfig)
    })
  })

  describe('Backward Compatibility Layer', () => {
    describe('INFRASTRUCTURE_CONFIG export', () => {
      it('should export default infrastructure config', () => {
        expect(INFRASTRUCTURE_CONFIG).toEqual(defaultInfrastructureConfig)
      })
    })
  })

  describe('Cross-field Validation and Business Logic', () => {
    it('should validate WebGPU config consistency', async () => {
      // When preferWebGPU is true, WebGPU config should be meaningful
      const config = {
        ...defaultRenderingConfig,
        preferWebGPU: true,
        webgpu: {
          preferredFormat: 'bgra8unorm' as const,
          powerPreference: 'high-performance' as const,
        },
      }
      
      const result = await Effect.runPromise(S.decodeUnknown(RenderingConfigSchema)(config))
      expect(result.preferWebGPU).toBe(true)
      expect(result.webgpu.powerPreference).toBe('high-performance')
    })

    it('should validate memory pool relationships', async () => {
      // Larger object pool should accommodate texture and geometry pools
      const config = {
        ...defaultMemoryConfig,
        objectPoolSize: 50000,
        texturePoolSize: 500,
        geometryPoolSize: 2000,
      }
      
      const result = await Effect.runPromise(S.decodeUnknown(MemoryConfigSchema)(config))
      expect(result.objectPoolSize).toBeGreaterThan(result.texturePoolSize)
      expect(result.objectPoolSize).toBeGreaterThan(result.geometryPoolSize)
    })

    it('should validate worker configuration consistency', async () => {
      // When useWorkers is false, maxWorkers should ideally be 0, but schema allows both
      const config = {
        ...defaultWorkerConfig,
        useWorkers: false,
        maxWorkers: 0,
      }
      
      const result = await Effect.runPromise(S.decodeUnknown(WorkerConfigSchema)(config))
      expect(result.useWorkers).toBe(false)
      expect(result.maxWorkers).toBe(0)
    })

    it('should validate monitoring sample rate vs max samples consistency', async () => {
      // Higher sample rates should be paired with reasonable max sample counts
      const config = {
        ...defaultMonitoringConfig,
        sampleRate: 1.0, // 100% sampling
        maxSamples: 10000, // High max to accommodate
      }
      
      const result = await Effect.runPromise(S.decodeUnknown(MonitoringConfigSchema)(config))
      expect(result.sampleRate).toBe(1.0)
      expect(result.maxSamples).toBe(10000)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle deeply nested invalid values', async () => {
      const invalidConfig = {
        ...defaultInfrastructureConfig,
        rendering: {
          ...defaultRenderingConfig,
          canvas: {
            ...defaultRenderingConfig.canvas,
            powerPreference: 'invalid-preference',
          },
        },
        memory: {
          ...defaultMemoryConfig,
          gcThreshold: 2.0, // invalid threshold
        },
      }

      await expect(
        Effect.runPromise(S.decodeUnknown(InfrastructureConfigSchema)(invalidConfig))
      ).rejects.toThrow()
    })

    it('should handle null/undefined nested objects', async () => {
      const invalidConfigs = [
        { ...defaultInfrastructureConfig, rendering: null },
        { ...defaultInfrastructureConfig, memory: undefined },
        { ...defaultInfrastructureConfig, workers: 'not-an-object' },
      ]

      for (const config of invalidConfigs) {
        await expect(
          Effect.runPromise(S.decodeUnknown(InfrastructureConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should handle extreme boundary values', async () => {
      // Test with extreme but valid values
      const extremeConfig = {
        ...defaultInfrastructureConfig,
        memory: {
          maxHeapSize: 1, // minimum valid value
          gcThreshold: 0.1, // minimum valid threshold
          objectPoolSize: 1000, // minimum valid pool size
          texturePoolSize: 10, // minimum valid pool size
          geometryPoolSize: 100, // minimum valid pool size
        },
        monitoring: {
          enabled: true,
          sampleRate: 1.0, // maximum sampling
          maxSamples: 10000, // maximum samples
          enableGPUTiming: true,
          enableMemoryProfiling: true,
          enableNetworkProfiling: true,
        },
      }
      
      const result = await Effect.runPromise(S.decodeUnknown(InfrastructureConfigSchema)(extremeConfig))
      expect(result.memory.maxHeapSize).toBe(1)
      expect(result.monitoring.sampleRate).toBe(1.0)
    })
  })
})