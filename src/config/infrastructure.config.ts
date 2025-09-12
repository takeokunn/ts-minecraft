/**
 * Infrastructure and technical configuration
 */

/**
 * Type guard to check if navigator has deviceMemory property
 */
const hasDeviceMemoryAPI = (nav: Navigator): nav is Navigator & { deviceMemory: number } => {
  return 'deviceMemory' in nav && typeof (nav as any).deviceMemory === 'number'
}

export interface InfrastructureConfig {
  // Rendering configuration
  rendering: {
    engine: 'three' | 'webgpu'
    preferWebGPU: boolean
    canvas: {
      antialias: boolean
      alpha: boolean
      powerPreference: 'default' | 'high-performance' | 'low-power'
      preserveDrawingBuffer: boolean
    }
    webgl: {
      contextAttributes: {
        antialias: boolean
        alpha: boolean
        depth: boolean
        stencil: boolean
        preserveDrawingBuffer: boolean
      }
    }
    webgpu: {
      preferredFormat: 'bgra8unorm' | 'rgba8unorm'
      powerPreference: 'low-power' | 'high-performance'
    }
  }

  // Memory management
  memory: {
    maxHeapSize: number // in MB
    gcThreshold: number // percentage (0-1)
    objectPoolSize: number
    texturePoolSize: number
    geometryPoolSize: number
  }

  // Worker configuration
  workers: {
    maxWorkers: number
    useWorkers: boolean
    workerScripts: {
      terrain: string
      physics: string
      compute: string
    }
    timeout: number // in milliseconds
  }

  // Network configuration
  network: {
    enableMultiplayer: boolean
    serverUrl?: string
    websocket: {
      reconnectAttempts: number
      reconnectInterval: number // in milliseconds
      timeout: number // in milliseconds
    }
    http: {
      timeout: number // in milliseconds
      retries: number
      retryDelay: number // in milliseconds
    }
  }

  // Storage configuration
  storage: {
    provider: 'localStorage' | 'indexedDB' | 'opfs'
    compression: boolean
    encryption: boolean
    maxSize: number // in MB
    cacheTTL: number // in milliseconds
  }

  // Performance monitoring
  monitoring: {
    enabled: boolean
    sampleRate: number // percentage (0-1)
    maxSamples: number
    enableGPUTiming: boolean
    enableMemoryProfiling: boolean
    enableNetworkProfiling: boolean
  }

  // Development tools
  development: {
    enableDebugger: boolean
    enableProfiler: boolean
    enableHotReload: boolean
    enableSourceMaps: boolean
    logLevel: 'error' | 'warn' | 'info' | 'debug' | 'trace'
  }

  // Asset management
  assets: {
    baseUrl: string
    textureAtlasSize: number
    compressionFormat: 'none' | 'gzip' | 'brotli'
    loadingStrategy: 'eager' | 'lazy' | 'progressive'
    cacheStrategy: 'memory' | 'disk' | 'hybrid'
  }

  // Audio configuration
  audio: {
    context: 'web-audio' | 'html5'
    sampleRate: number
    bufferSize: number
    maxSources: number
    enableCompression: boolean
    spatialAudio: {
      enabled: boolean
      algorithm: 'panner' | 'hrtf'
      distanceModel: 'linear' | 'inverse' | 'exponential'
    }
  }

  // Security configuration
  security: {
    contentSecurityPolicy: boolean
    crossOriginIsolation: boolean
    sharedArrayBuffer: boolean
    trustedTypes: boolean
  }
}

const defaultInfrastructureConfig: InfrastructureConfig = {
  rendering: {
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
  },

  memory: {
    maxHeapSize: 1024, // 1GB
    gcThreshold: 0.8, // 80%
    objectPoolSize: 10000,
    texturePoolSize: 100,
    geometryPoolSize: 500,
  },

  workers: {
    maxWorkers: Math.min(navigator.hardwareConcurrency || 4, 8),
    useWorkers: true,
    workerScripts: {
      terrain: '/workers/terrain-generation.worker.js',
      physics: '/workers/physics.worker.js',
      compute: '/workers/computation.worker.js',
    },
    timeout: 10000, // 10 seconds
  },

  network: {
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
  },

  storage: {
    provider: 'indexedDB',
    compression: true,
    encryption: false,
    maxSize: 500, // 500MB
    cacheTTL: 24 * 60 * 60 * 1000, // 24 hours
  },

  monitoring: {
    enabled: true,
    sampleRate: 0.1, // 10%
    maxSamples: 1000,
    enableGPUTiming: true,
    enableMemoryProfiling: true,
    enableNetworkProfiling: false,
  },

  development: {
    enableDebugger: false,
    enableProfiler: false,
    enableHotReload: false,
    enableSourceMaps: false,
    logLevel: 'warn',
  },

  assets: {
    baseUrl: '/assets',
    textureAtlasSize: 1024,
    compressionFormat: 'gzip',
    loadingStrategy: 'progressive',
    cacheStrategy: 'hybrid',
  },

  audio: {
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
  },

  security: {
    contentSecurityPolicy: false,
    crossOriginIsolation: false,
    sharedArrayBuffer: false,
    trustedTypes: false,
  },
}

// Create configuration with environment overrides
const createInfrastructureConfig = (): InfrastructureConfig => {
  const config = { ...defaultInfrastructureConfig }

  // Development overrides
  if (import.meta.env.MODE === 'development') {
    config.development.enableDebugger = true
    config.development.enableProfiler = true
    config.development.enableHotReload = true
    config.development.enableSourceMaps = true
    config.development.logLevel = 'debug'
    config.monitoring.enabled = true
    config.monitoring.sampleRate = 1.0 // 100% in development
  }

  // Production optimizations
  if (import.meta.env.MODE === 'production') {
    config.memory.gcThreshold = 0.7 // More aggressive GC
    config.assets.compressionFormat = 'brotli'
    config.assets.loadingStrategy = 'progressive'
    config.security.contentSecurityPolicy = true
    config.security.trustedTypes = true
    config.monitoring.sampleRate = 0.01 // 1% in production
  }

  // Feature detection and capability adjustment
  if (typeof navigator !== 'undefined') {
    // Adjust based on device capabilities
    const memory = hasDeviceMemoryAPI(navigator) ? navigator.deviceMemory : undefined
    if (memory && memory < 4) {
      // Low memory device
      config.memory.maxHeapSize = 512
      config.memory.objectPoolSize = 5000
      config.workers.maxWorkers = Math.min(config.workers.maxWorkers, 2)
      config.audio.maxSources = 32
    }

    // Check for WebGPU support
    if (!navigator.gpu) {
      config.rendering.preferWebGPU = false
      config.rendering.engine = 'three'
    }

    // Check for SharedArrayBuffer support
    if (typeof SharedArrayBuffer !== 'undefined') {
      config.security.sharedArrayBuffer = true
    }
  }

  return config
}

export const INFRASTRUCTURE_CONFIG = createInfrastructureConfig()

// Configuration validation
export const validateInfrastructureConfig = (config: InfrastructureConfig): boolean => {
  if (config.memory.maxHeapSize <= 0) {
    console.error('Max heap size must be positive')
    return false
  }

  if (config.workers.maxWorkers <= 0 || config.workers.maxWorkers > 32) {
    console.error('Max workers must be between 1 and 32')
    return false
  }

  if (config.monitoring.sampleRate < 0 || config.monitoring.sampleRate > 1) {
    console.error('Sample rate must be between 0 and 1')
    return false
  }

  if (config.storage.maxSize <= 0) {
    console.error('Max storage size must be positive')
    return false
  }

  if (config.assets.textureAtlasSize <= 0 || !isPowerOfTwo(config.assets.textureAtlasSize)) {
    console.error('Texture atlas size must be a positive power of 2')
    return false
  }

  return true
}

// Utility function to check if a number is power of 2
const isPowerOfTwo = (value: number): boolean => {
  return (value & (value - 1)) === 0 && value !== 0
}

// Capability detection
export const detectCapabilities = () => {
  const capabilities = {
    webgl2: false,
    webgpu: false,
    workers: false,
    sharedArrayBuffer: false,
    offscreenCanvas: false,
    imagebitmap: false,
    webassembly: false,
  }

  if (typeof navigator !== 'undefined') {
    // WebGL2 detection
    const canvas = document.createElement('canvas')
    capabilities.webgl2 = !!canvas.getContext('webgl2')

    // WebGPU detection
    capabilities.webgpu = !!navigator.gpu

    // Worker detection
    capabilities.workers = typeof Worker !== 'undefined'

    // SharedArrayBuffer detection
    capabilities.sharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined'

    // OffscreenCanvas detection
    capabilities.offscreenCanvas = typeof OffscreenCanvas !== 'undefined'

    // ImageBitmap detection
    capabilities.imagebitmap = typeof createImageBitmap !== 'undefined'

    // WebAssembly detection
    capabilities.webassembly = typeof WebAssembly !== 'undefined'
  }

  return capabilities
}

// Get optimal configuration based on device capabilities
export const getOptimalInfrastructureConfig = (): InfrastructureConfig => {
  const capabilities = detectCapabilities()
  const config = { ...INFRASTRUCTURE_CONFIG }

  if (!capabilities.webgpu) {
    config.rendering.preferWebGPU = false
    config.rendering.engine = 'three'
  }

  if (!capabilities.workers) {
    config.workers.useWorkers = false
    config.workers.maxWorkers = 0
  }

  if (!capabilities.sharedArrayBuffer) {
    config.security.sharedArrayBuffer = false
  }

  if (!capabilities.webassembly) {
    // Disable WASM-dependent features
    config.storage.compression = false
  }

  return config
}

// Validate configuration on load
if (!validateInfrastructureConfig(INFRASTRUCTURE_CONFIG)) {
  throw new Error('Invalid infrastructure configuration')
}
