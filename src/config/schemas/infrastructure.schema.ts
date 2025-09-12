import * as S from 'effect/Schema'
import {
  PositiveNumber,
  PositiveInteger,
  NonNegativeInteger,
  Percentage,
  PowerOfTwo,
  RenderingEngine,
  PowerPreference,
  AudioContext,
  StorageProvider,
  CompressionFormat,
  LoadingStrategy,
  CacheStrategy,
  LogLevel,
  SampleRate,
  AudioBufferSize,
  DeviceMemoryGB,
  MaxWorkers,
  MemorySizeMB,
  GCThreshold,
  RetryAttempts,
  TimeoutMs,
  DurationMs,
  FilePath,
  HttpUrl,
  OptionalHttpUrl,
} from './common.schema'

/**
 * InfrastructureConfig schemas for comprehensive system configuration
 */

// WebGL Context Attributes Schema
export const WebGLContextAttributesSchema = S.Struct({
  antialias: S.Boolean.pipe(
    S.annotations({
      title: 'WebGL Antialias',
      description: 'Whether to enable antialiasing in WebGL context'
    })
  ),
  alpha: S.Boolean.pipe(
    S.annotations({
      title: 'WebGL Alpha',
      description: 'Whether WebGL context should have alpha channel'
    })
  ),
  depth: S.Boolean.pipe(
    S.annotations({
      title: 'WebGL Depth Buffer',
      description: 'Whether to enable depth buffer'
    })
  ),
  stencil: S.Boolean.pipe(
    S.annotations({
      title: 'WebGL Stencil Buffer',
      description: 'Whether to enable stencil buffer'
    })
  ),
  preserveDrawingBuffer: S.Boolean.pipe(
    S.annotations({
      title: 'Preserve Drawing Buffer',
      description: 'Whether to preserve the drawing buffer'
    })
  ),
})

// Canvas Configuration Schema
export const CanvasConfigSchema = S.Struct({
  antialias: S.Boolean.pipe(
    S.annotations({
      title: 'Canvas Antialias',
      description: 'Whether to enable antialiasing for canvas'
    })
  ),
  alpha: S.Boolean.pipe(
    S.annotations({
      title: 'Canvas Alpha',
      description: 'Whether canvas should have alpha channel'
    })
  ),
  powerPreference: PowerPreference.pipe(
    S.annotations({
      title: 'Power Preference',
      description: 'GPU power preference for canvas'
    })
  ),
  preserveDrawingBuffer: S.Boolean.pipe(
    S.annotations({
      title: 'Preserve Drawing Buffer',
      description: 'Whether to preserve the drawing buffer'
    })
  ),
})

// WebGPU Configuration Schema
export const WebGPUConfigSchema = S.Struct({
  preferredFormat: S.Literal('bgra8unorm', 'rgba8unorm').pipe(
    S.annotations({
      title: 'Preferred Format',
      description: 'Preferred WebGPU texture format'
    })
  ),
  powerPreference: S.Literal('low-power', 'high-performance').pipe(
    S.annotations({
      title: 'Power Preference',
      description: 'WebGPU power preference'
    })
  ),
})

// Rendering Configuration Schema
export const RenderingConfigSchema = S.Struct({
  engine: RenderingEngine.pipe(
    S.annotations({
      title: 'Rendering Engine',
      description: 'Graphics rendering engine to use'
    })
  ),
  preferWebGPU: S.Boolean.pipe(
    S.annotations({
      title: 'Prefer WebGPU',
      description: 'Whether to prefer WebGPU over WebGL when available'
    })
  ),
  canvas: CanvasConfigSchema.pipe(
    S.annotations({
      title: 'Canvas Configuration',
      description: 'HTML5 Canvas configuration options'
    })
  ),
  webgl: S.Struct({
    contextAttributes: WebGLContextAttributesSchema.pipe(
      S.annotations({
        title: 'WebGL Context Attributes',
        description: 'WebGL context creation attributes'
      })
    ),
  }).pipe(
    S.annotations({
      title: 'WebGL Configuration',
      description: 'WebGL-specific rendering options'
    })
  ),
  webgpu: WebGPUConfigSchema.pipe(
    S.annotations({
      title: 'WebGPU Configuration',
      description: 'WebGPU-specific rendering options'
    })
  ),
})

// Memory Management Configuration Schema
export const MemoryConfigSchema = S.Struct({
  maxHeapSize: MemorySizeMB.pipe(
    S.annotations({
      title: 'Max Heap Size',
      description: 'Maximum heap size in megabytes'
    })
  ),
  gcThreshold: GCThreshold.pipe(
    S.annotations({
      title: 'GC Threshold',
      description: 'Garbage collection threshold percentage'
    })
  ),
  objectPoolSize: PositiveInteger.pipe(
    S.between(1000, 100000),
    S.annotations({
      title: 'Object Pool Size',
      description: 'Size of object pool for reusable objects (1000-100000)'
    })
  ),
  texturePoolSize: PositiveInteger.pipe(
    S.between(10, 1000),
    S.annotations({
      title: 'Texture Pool Size',
      description: 'Size of texture pool for reusable textures (10-1000)'
    })
  ),
  geometryPoolSize: PositiveInteger.pipe(
    S.between(100, 10000),
    S.annotations({
      title: 'Geometry Pool Size',
      description: 'Size of geometry pool for reusable geometries (100-10000)'
    })
  ),
})

// Worker Scripts Configuration Schema
export const WorkerScriptsSchema = S.Struct({
  terrain: FilePath.pipe(
    S.annotations({
      title: 'Terrain Worker Script',
      description: 'Path to terrain generation worker script'
    })
  ),
  physics: FilePath.pipe(
    S.annotations({
      title: 'Physics Worker Script',
      description: 'Path to physics computation worker script'
    })
  ),
  compute: FilePath.pipe(
    S.annotations({
      title: 'Compute Worker Script',
      description: 'Path to general computation worker script'
    })
  ),
})

// Worker Configuration Schema
export const WorkerConfigSchema = S.Struct({
  maxWorkers: MaxWorkers.pipe(
    S.annotations({
      title: 'Max Workers',
      description: 'Maximum number of web workers to use'
    })
  ),
  useWorkers: S.Boolean.pipe(
    S.annotations({
      title: 'Use Workers',
      description: 'Whether to use web workers for computations'
    })
  ),
  workerScripts: WorkerScriptsSchema.pipe(
    S.annotations({
      title: 'Worker Scripts',
      description: 'Paths to worker script files'
    })
  ),
  timeout: TimeoutMs.pipe(
    S.annotations({
      title: 'Worker Timeout',
      description: 'Timeout for worker operations in milliseconds'
    })
  ),
})

// WebSocket Configuration Schema
export const WebSocketConfigSchema = S.Struct({
  reconnectAttempts: RetryAttempts.pipe(
    S.annotations({
      title: 'Reconnect Attempts',
      description: 'Number of WebSocket reconnection attempts'
    })
  ),
  reconnectInterval: DurationMs.pipe(
    S.annotations({
      title: 'Reconnect Interval',
      description: 'Interval between reconnection attempts in milliseconds'
    })
  ),
  timeout: TimeoutMs.pipe(
    S.annotations({
      title: 'WebSocket Timeout',
      description: 'WebSocket connection timeout in milliseconds'
    })
  ),
})

// HTTP Configuration Schema
export const HttpConfigSchema = S.Struct({
  timeout: TimeoutMs.pipe(
    S.annotations({
      title: 'HTTP Timeout',
      description: 'HTTP request timeout in milliseconds'
    })
  ),
  retries: RetryAttempts.pipe(
    S.annotations({
      title: 'HTTP Retries',
      description: 'Number of HTTP request retry attempts'
    })
  ),
  retryDelay: DurationMs.pipe(
    S.annotations({
      title: 'Retry Delay',
      description: 'Delay between HTTP retry attempts in milliseconds'
    })
  ),
})

// Network Configuration Schema
export const NetworkConfigSchema = S.Struct({
  enableMultiplayer: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Multiplayer',
      description: 'Whether multiplayer functionality is enabled'
    })
  ),
  serverUrl: OptionalHttpUrl.pipe(
    S.annotations({
      title: 'Server URL',
      description: 'URL of the game server for multiplayer'
    })
  ),
  websocket: WebSocketConfigSchema.pipe(
    S.annotations({
      title: 'WebSocket Configuration',
      description: 'WebSocket connection configuration'
    })
  ),
  http: HttpConfigSchema.pipe(
    S.annotations({
      title: 'HTTP Configuration',
      description: 'HTTP request configuration'
    })
  ),
})

// Storage Configuration Schema
export const StorageConfigSchema = S.Struct({
  provider: StorageProvider.pipe(
    S.annotations({
      title: 'Storage Provider',
      description: 'Type of storage provider to use'
    })
  ),
  compression: S.Boolean.pipe(
    S.annotations({
      title: 'Storage Compression',
      description: 'Whether to compress stored data'
    })
  ),
  encryption: S.Boolean.pipe(
    S.annotations({
      title: 'Storage Encryption',
      description: 'Whether to encrypt stored data'
    })
  ),
  maxSize: MemorySizeMB.pipe(
    S.annotations({
      title: 'Max Storage Size',
      description: 'Maximum storage size in megabytes'
    })
  ),
  cacheTTL: DurationMs.pipe(
    S.annotations({
      title: 'Cache TTL',
      description: 'Cache time-to-live in milliseconds'
    })
  ),
})

// Performance Monitoring Configuration Schema
export const MonitoringConfigSchema = S.Struct({
  enabled: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Monitoring',
      description: 'Whether performance monitoring is enabled'
    })
  ),
  sampleRate: Percentage.pipe(
    S.annotations({
      title: 'Sample Rate',
      description: 'Performance monitoring sample rate (0-1)'
    })
  ),
  maxSamples: PositiveInteger.pipe(
    S.between(100, 10000),
    S.annotations({
      title: 'Max Samples',
      description: 'Maximum number of performance samples to keep (100-10000)'
    })
  ),
  enableGPUTiming: S.Boolean.pipe(
    S.annotations({
      title: 'Enable GPU Timing',
      description: 'Whether to monitor GPU timing information'
    })
  ),
  enableMemoryProfiling: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Memory Profiling',
      description: 'Whether to profile memory usage'
    })
  ),
  enableNetworkProfiling: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Network Profiling',
      description: 'Whether to profile network requests'
    })
  ),
})

// Development Tools Configuration Schema
export const DevelopmentConfigSchema = S.Struct({
  enableDebugger: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Debugger',
      description: 'Whether development debugger is enabled'
    })
  ),
  enableProfiler: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Profiler',
      description: 'Whether performance profiler is enabled'
    })
  ),
  enableHotReload: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Hot Reload',
      description: 'Whether hot module reloading is enabled'
    })
  ),
  enableSourceMaps: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Source Maps',
      description: 'Whether source maps are enabled for debugging'
    })
  ),
  logLevel: LogLevel.pipe(
    S.annotations({
      title: 'Development Log Level',
      description: 'Logging level for development tools'
    })
  ),
})

// Asset Management Configuration Schema
export const AssetConfigSchema = S.Struct({
  baseUrl: S.NonEmptyString.pipe(
    S.annotations({
      title: 'Asset Base URL',
      description: 'Base URL for asset loading'
    })
  ),
  textureAtlasSize: PowerOfTwo.pipe(
    S.between(256, 4096),
    S.annotations({
      title: 'Texture Atlas Size',
      description: 'Size of texture atlas in pixels (power of 2, 256-4096)'
    })
  ),
  compressionFormat: CompressionFormat.pipe(
    S.annotations({
      title: 'Asset Compression Format',
      description: 'Compression format for asset files'
    })
  ),
  loadingStrategy: LoadingStrategy.pipe(
    S.annotations({
      title: 'Loading Strategy',
      description: 'Strategy for loading assets'
    })
  ),
  cacheStrategy: CacheStrategy.pipe(
    S.annotations({
      title: 'Cache Strategy',
      description: 'Strategy for caching assets'
    })
  ),
})

// Spatial Audio Configuration Schema
export const SpatialAudioConfigSchema = S.Struct({
  enabled: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Spatial Audio',
      description: 'Whether spatial audio is enabled'
    })
  ),
  algorithm: S.Literal('panner', 'hrtf').pipe(
    S.annotations({
      title: 'Spatial Algorithm',
      description: 'Spatial audio algorithm to use'
    })
  ),
  distanceModel: S.Literal('linear', 'inverse', 'exponential').pipe(
    S.annotations({
      title: 'Distance Model',
      description: 'Audio distance attenuation model'
    })
  ),
})

// Audio Configuration Schema
export const AudioConfigSchema = S.Struct({
  context: AudioContext.pipe(
    S.annotations({
      title: 'Audio Context',
      description: 'Type of audio context to use'
    })
  ),
  sampleRate: SampleRate.pipe(
    S.annotations({
      title: 'Audio Sample Rate',
      description: 'Audio sample rate in Hz'
    })
  ),
  bufferSize: AudioBufferSize.pipe(
    S.annotations({
      title: 'Audio Buffer Size',
      description: 'Audio buffer size in samples'
    })
  ),
  maxSources: PositiveInteger.pipe(
    S.between(8, 256),
    S.annotations({
      title: 'Max Audio Sources',
      description: 'Maximum number of concurrent audio sources (8-256)'
    })
  ),
  enableCompression: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Audio Compression',
      description: 'Whether to use audio compression'
    })
  ),
  spatialAudio: SpatialAudioConfigSchema.pipe(
    S.annotations({
      title: 'Spatial Audio Configuration',
      description: '3D spatial audio settings'
    })
  ),
})

// Security Configuration Schema
export const SecurityConfigSchema = S.Struct({
  contentSecurityPolicy: S.Boolean.pipe(
    S.annotations({
      title: 'Content Security Policy',
      description: 'Whether CSP is enabled'
    })
  ),
  crossOriginIsolation: S.Boolean.pipe(
    S.annotations({
      title: 'Cross-Origin Isolation',
      description: 'Whether cross-origin isolation is enabled'
    })
  ),
  sharedArrayBuffer: S.Boolean.pipe(
    S.annotations({
      title: 'SharedArrayBuffer Support',
      description: 'Whether SharedArrayBuffer is supported and enabled'
    })
  ),
  trustedTypes: S.Boolean.pipe(
    S.annotations({
      title: 'Trusted Types',
      description: 'Whether Trusted Types API is enabled'
    })
  ),
})

// Main Infrastructure Configuration Schema
export const InfrastructureConfigSchema = S.Struct({
  rendering: RenderingConfigSchema.pipe(
    S.annotations({
      title: 'Rendering Configuration',
      description: 'Graphics rendering and GPU settings'
    })
  ),
  memory: MemoryConfigSchema.pipe(
    S.annotations({
      title: 'Memory Configuration',
      description: 'Memory management and garbage collection settings'
    })
  ),
  workers: WorkerConfigSchema.pipe(
    S.annotations({
      title: 'Worker Configuration',
      description: 'Web Workers configuration for background processing'
    })
  ),
  network: NetworkConfigSchema.pipe(
    S.annotations({
      title: 'Network Configuration',
      description: 'Network and multiplayer communication settings'
    })
  ),
  storage: StorageConfigSchema.pipe(
    S.annotations({
      title: 'Storage Configuration',
      description: 'Data storage and persistence settings'
    })
  ),
  monitoring: MonitoringConfigSchema.pipe(
    S.annotations({
      title: 'Monitoring Configuration',
      description: 'Performance monitoring and metrics collection'
    })
  ),
  development: DevelopmentConfigSchema.pipe(
    S.annotations({
      title: 'Development Configuration',
      description: 'Development tools and debugging settings'
    })
  ),
  assets: AssetConfigSchema.pipe(
    S.annotations({
      title: 'Asset Configuration',
      description: 'Asset loading and management settings'
    })
  ),
  audio: AudioConfigSchema.pipe(
    S.annotations({
      title: 'Audio Configuration',
      description: 'Audio system and processing settings'
    })
  ),
  security: SecurityConfigSchema.pipe(
    S.annotations({
      title: 'Security Configuration',
      description: 'Security policies and feature controls'
    })
  ),
}).pipe(
  S.annotations({
    title: 'Infrastructure Configuration',
    description: 'Complete infrastructure configuration for system-level settings'
  })
)

// Export types
export type InfrastructureConfig = S.Schema.Type<typeof InfrastructureConfigSchema>
export type RenderingConfig = S.Schema.Type<typeof RenderingConfigSchema>
export type MemoryConfig = S.Schema.Type<typeof MemoryConfigSchema>
export type WorkerConfig = S.Schema.Type<typeof WorkerConfigSchema>
export type NetworkConfig = S.Schema.Type<typeof NetworkConfigSchema>
export type StorageConfig = S.Schema.Type<typeof StorageConfigSchema>
export type MonitoringConfig = S.Schema.Type<typeof MonitoringConfigSchema>
export type DevelopmentConfig = S.Schema.Type<typeof DevelopmentConfigSchema>
export type AssetConfig = S.Schema.Type<typeof AssetConfigSchema>
export type AudioConfig = S.Schema.Type<typeof AudioConfigSchema>
export type SecurityConfig = S.Schema.Type<typeof SecurityConfigSchema>

// Default configurations
export const defaultRenderingConfig: RenderingConfig = {
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

export const defaultMemoryConfig: MemoryConfig = {
  maxHeapSize: 1024, // 1GB
  gcThreshold: 0.8, // 80%
  objectPoolSize: 10000,
  texturePoolSize: 100,
  geometryPoolSize: 500,
}

export const defaultWorkerConfig: WorkerConfig = {
  maxWorkers: 4, // Will be adjusted based on navigator.hardwareConcurrency
  useWorkers: true,
  workerScripts: {
    terrain: '/workers/terrain-generation.worker.js',
    physics: '/workers/physics.worker.js',
    compute: '/workers/computation.worker.js',
  },
  timeout: 10000, // 10 seconds
}

export const defaultNetworkConfig: NetworkConfig = {
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

export const defaultStorageConfig: StorageConfig = {
  provider: 'indexedDB',
  compression: true,
  encryption: false,
  maxSize: 500, // 500MB
  cacheTTL: 86400000, // 24 hours
}

export const defaultMonitoringConfig: MonitoringConfig = {
  enabled: true,
  sampleRate: 0.1, // 10%
  maxSamples: 1000,
  enableGPUTiming: true,
  enableMemoryProfiling: true,
  enableNetworkProfiling: false,
}

export const defaultDevelopmentConfig: DevelopmentConfig = {
  enableDebugger: false,
  enableProfiler: false,
  enableHotReload: false,
  enableSourceMaps: false,
  logLevel: 'warn',
}

export const defaultAssetConfig: AssetConfig = {
  baseUrl: '/assets',
  textureAtlasSize: 1024,
  compressionFormat: 'gzip',
  loadingStrategy: 'progressive',
  cacheStrategy: 'hybrid',
}

export const defaultAudioConfig: AudioConfig = {
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

export const defaultSecurityConfig: SecurityConfig = {
  contentSecurityPolicy: false,
  crossOriginIsolation: false,
  sharedArrayBuffer: false,
  trustedTypes: false,
}

export const defaultInfrastructureConfig: InfrastructureConfig = {
  rendering: defaultRenderingConfig,
  memory: defaultMemoryConfig,
  workers: defaultWorkerConfig,
  network: defaultNetworkConfig,
  storage: defaultStorageConfig,
  monitoring: defaultMonitoringConfig,
  development: defaultDevelopmentConfig,
  assets: defaultAssetConfig,
  audio: defaultAudioConfig,
  security: defaultSecurityConfig,
}