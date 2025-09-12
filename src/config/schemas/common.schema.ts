import * as S from 'effect/Schema'

/**
 * Common schema definitions used across configuration modules
 */

// Basic validated primitives
export const PositiveNumber = S.Number.pipe(
  S.positive(),
  S.finite(),
  S.annotations({
    title: 'Positive Number',
    description: 'A positive finite number greater than 0'
  })
)

export const NonNegativeNumber = S.Number.pipe(
  S.nonNegative(),
  S.annotations({
    title: 'Non-negative Number', 
    description: 'A number greater than or equal to 0'
  })
)

export const PositiveInteger = S.Int.pipe(
  S.positive(),
  S.finite(),
  S.annotations({
    title: 'Positive Integer',
    description: 'A positive finite integer greater than 0'
  })
)

export const NonNegativeInteger = S.Int.pipe(
  S.nonNegative(),
  S.annotations({
    title: 'Non-negative Integer',
    description: 'An integer greater than or equal to 0'
  })
)

export const NonEmptyString = S.NonEmptyString.pipe(
  S.annotations({
    title: 'Non-empty String',
    description: 'A string that is not empty'
  })
)

export const Percentage = S.Number.pipe(
  S.between(0, 1),
  S.annotations({
    title: 'Percentage',
    description: 'A percentage value between 0 and 1'
  })
)

export const PercentageInt = S.Int.pipe(
  S.between(0, 100),
  S.annotations({
    title: 'Percentage Integer',
    description: 'An integer percentage value between 0 and 100'
  })
)

// Volume control (0 to 1 range)
export const VolumeLevel = S.Number.pipe(
  S.between(0, 1),
  S.annotations({
    title: 'Volume Level',
    description: 'Audio volume level between 0 (silent) and 1 (full volume)'
  })
)

// Field of view constraints
export const FieldOfView = S.Number.pipe(
  S.between(30, 120),
  S.annotations({
    title: 'Field of View',
    description: 'Field of view in degrees, between 30 and 120'
  })
)

// Render distance constraints
export const RenderDistance = S.Int.pipe(
  S.between(1, 32),
  S.annotations({
    title: 'Render Distance', 
    description: 'Render distance in chunks, between 1 and 32'
  })
)

// Chunk size (must be positive power of 2)
export const ChunkSize = S.Int.pipe(
  S.positive(),
  S.filter((n): n is number => (n & (n - 1)) === 0, {
    message: () => 'Chunk size must be a power of 2'
  }),
  S.annotations({
    title: 'Chunk Size',
    description: 'Chunk size must be a positive power of 2'
  })
)

// Power of 2 validator for texture sizes
export const PowerOfTwo = S.Int.pipe(
  S.positive(),
  S.filter((n): n is number => (n & (n - 1)) === 0, {
    message: () => 'Value must be a power of 2'
  }),
  S.annotations({
    title: 'Power of Two',
    description: 'A positive integer that is a power of 2'
  })
)

// Common enums
export const Environment = S.Literal('development', 'production', 'test').pipe(
  S.annotations({
    title: 'Environment',
    description: 'Application environment'
  })
)

export const LogLevel = S.Literal('error', 'warn', 'info', 'debug', 'trace').pipe(
  S.annotations({
    title: 'Log Level',
    description: 'Logging level'
  })
)

export const GameMode = S.Literal('survival', 'creative', 'adventure', 'spectator').pipe(
  S.annotations({
    title: 'Game Mode',
    description: 'Minecraft game mode'
  })
)

export const Difficulty = S.Literal('peaceful', 'easy', 'normal', 'hard').pipe(
  S.annotations({
    title: 'Difficulty',
    description: 'Game difficulty level'
  })
)

export const RenderingEngine = S.Literal('three', 'webgpu').pipe(
  S.annotations({
    title: 'Rendering Engine',
    description: 'Graphics rendering engine'
  })
)

export const PowerPreference = S.Literal('default', 'high-performance', 'low-power').pipe(
  S.annotations({
    title: 'Power Preference',
    description: 'GPU power preference for rendering'
  })
)

export const TextureFiltering = S.Literal('nearest', 'linear', 'trilinear').pipe(
  S.annotations({
    title: 'Texture Filtering',
    description: 'Texture filtering method'
  })
)

export const AudioContext = S.Literal('web-audio', 'html5').pipe(
  S.annotations({
    title: 'Audio Context',
    description: 'Audio context type'
  })
)

export const StorageProvider = S.Literal('localStorage', 'indexedDB', 'opfs').pipe(
  S.annotations({
    title: 'Storage Provider',
    description: 'Storage provider type'
  })
)

export const CompressionFormat = S.Literal('none', 'gzip', 'brotli').pipe(
  S.annotations({
    title: 'Compression Format',
    description: 'Asset compression format'
  })
)

export const LoadingStrategy = S.Literal('eager', 'lazy', 'progressive').pipe(
  S.annotations({
    title: 'Loading Strategy',
    description: 'Asset loading strategy'
  })
)

export const CacheStrategy = S.Literal('memory', 'disk', 'hybrid').pipe(
  S.annotations({
    title: 'Cache Strategy',
    description: 'Asset caching strategy'
  })
)

// Common data structures
export const Position3D = S.Struct({
  x: S.Number,
  y: S.Number,
  z: S.Number,
}).pipe(
  S.annotations({
    title: '3D Position',
    description: 'A position in 3D space with x, y, z coordinates'
  })
)

export const KeyBinding = S.NonEmptyString.pipe(
  S.annotations({
    title: 'Key Binding',
    description: 'A keyboard key binding identifier'
  })
)

// URL validation
export const HttpUrl = S.String.pipe(
  S.startsWith('http'),
  S.annotations({
    title: 'HTTP URL',
    description: 'A valid HTTP or HTTPS URL'
  })
)

export const OptionalHttpUrl = S.Union(HttpUrl, S.Undefined)

// File path validation
export const FilePath = S.NonEmptyString.pipe(
  S.annotations({
    title: 'File Path',
    description: 'A valid file path'
  })
)

// Array validation helpers
export const NonEmptyArray = <A>(item: S.Schema<A>) =>
  S.Array(item).pipe(
    S.minItems(1),
    S.annotations({
      title: 'Non-empty Array',
      description: 'An array with at least one item'
    })
  )

// Time duration in milliseconds
export const DurationMs = PositiveInteger.pipe(
  S.annotations({
    title: 'Duration (ms)',
    description: 'Duration in milliseconds'
  })
)

// Timeout duration (can be zero for immediate timeout)
export const TimeoutMs = NonNegativeInteger.pipe(
  S.annotations({
    title: 'Timeout (ms)',
    description: 'Timeout duration in milliseconds'
  })
)

// Sample rate constraints
export const SampleRate = S.Number.pipe(
  S.between(8000, 96000),
  S.annotations({
    title: 'Sample Rate',
    description: 'Audio sample rate in Hz (8000-96000)'
  })
)

// Buffer size for audio (must be power of 2)
export const AudioBufferSize = S.Int.pipe(
  S.positive(),
  S.filter((n): n is number => (n & (n - 1)) === 0, {
    message: () => 'Audio buffer size must be a power of 2'
  }),
  S.between(256, 16384),
  S.annotations({
    title: 'Audio Buffer Size',
    description: 'Audio buffer size in samples (256-16384, power of 2)'
  })
)

// Device memory in GB
export const DeviceMemoryGB = S.Number.pipe(
  S.positive(),
  S.annotations({
    title: 'Device Memory (GB)',
    description: 'Device memory in gigabytes'
  })
)

// Maximum number of concurrent workers
export const MaxWorkers = S.Int.pipe(
  S.between(0, 32),
  S.annotations({
    title: 'Max Workers',
    description: 'Maximum number of web workers (0-32)'
  })
)

// Target FPS
export const TargetFPS = S.Int.pipe(
  S.positive(),
  S.between(30, 240),
  S.annotations({
    title: 'Target FPS',
    description: 'Target frames per second (30-240)'
  })
)

// Memory size in MB
export const MemorySizeMB = PositiveInteger.pipe(
  S.annotations({
    title: 'Memory Size (MB)',
    description: 'Memory size in megabytes'
  })
)

// GC threshold percentage
export const GCThreshold = S.Number.pipe(
  S.between(0.1, 0.95),
  S.annotations({
    title: 'GC Threshold',
    description: 'Garbage collection threshold as percentage (0.1-0.95)'
  })
)

// Retry attempts
export const RetryAttempts = S.Int.pipe(
  S.between(0, 10),
  S.annotations({
    title: 'Retry Attempts',
    description: 'Number of retry attempts (0-10)'
  })
)

// Mouse sensitivity
export const MouseSensitivity = S.Number.pipe(
  S.between(0.1, 5.0),
  S.annotations({
    title: 'Mouse Sensitivity',
    description: 'Mouse sensitivity multiplier (0.1-5.0)'
  })
)

// Brightness/contrast/saturation adjustments
export const ColorAdjustment = S.Number.pipe(
  S.between(0.1, 2.0),
  S.annotations({
    title: 'Color Adjustment',
    description: 'Color adjustment value (0.1-2.0, 1.0 = normal)'
  })
)