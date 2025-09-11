import * as S from 'effect/Schema'

/**
 * Computation Worker Protocol
 * Type-safe message schemas for general computation worker communication
 */

// ============================================
// Base Computation Types
// ============================================

/**
 * Computation type enumeration
 */
export const ComputationType = S.Union(
  S.Literal('pathfinding'),
  S.Literal('noise_generation'),
  S.Literal('data_compression'),
  S.Literal('data_decompression'),
  S.Literal('image_processing'),
  S.Literal('math_operations'),
  S.Literal('crypto_operations'),
  S.Literal('string_processing'),
  S.Literal('array_operations'),
  S.Literal('custom'),
).pipe(S.identifier('ComputationType'))
export type ComputationType = S.Schema.Type<typeof ComputationType>

/**
 * Priority level for computations
 */
export const ComputationPriority = S.Union(
  S.Literal('low'),
  S.Literal('normal'),
  S.Literal('high'),
  S.Literal('critical'),
).pipe(S.identifier('ComputationPriority'))
export type ComputationPriority = S.Schema.Type<typeof ComputationPriority>

/**
 * Computation execution mode
 */
export const ExecutionMode = S.Union(
  S.Literal('single_threaded'),
  S.Literal('multi_threaded'),
  S.Literal('simd'),
  S.Literal('wasm'),
  S.Literal('gpu_compute'),
).pipe(S.identifier('ExecutionMode'))
export type ExecutionMode = S.Schema.Type<typeof ExecutionMode>

// ============================================
// Pathfinding Types
// ============================================

/**
 * 3D Position for pathfinding
 */
export const Position3D = S.Struct({
  x: S.Number.pipe(S.finite),
  y: S.Number.pipe(S.finite),
  z: S.Number.pipe(S.finite),
}).pipe(S.identifier('Position3D'))
export type Position3D = S.Schema.Type<typeof Position3D>

/**
 * Pathfinding algorithm type
 */
export const PathfindingAlgorithm = S.Union(
  S.Literal('a_star'),
  S.Literal('dijkstra'),
  S.Literal('breadth_first'),
  S.Literal('depth_first'),
  S.Literal('jps'), // Jump Point Search
  S.Literal('theta_star'),
  S.Literal('hierarchical'),
).pipe(S.identifier('PathfindingAlgorithm'))
export type PathfindingAlgorithm = S.Schema.Type<typeof PathfindingAlgorithm>

/**
 * Navigation node
 */
export const NavigationNode = S.Struct({
  position: Position3D,
  walkable: S.Boolean,
  cost: S.Number.pipe(S.nonNegative),
  connections: S.optional(S.Array(Position3D)),
  tags: S.optional(S.Array(S.String)),
}).pipe(S.identifier('NavigationNode'))
export type NavigationNode = S.Schema.Type<typeof NavigationNode>

/**
 * Pathfinding parameters
 */
export const PathfindingParams = S.Struct({
  start: Position3D,
  goal: Position3D,
  algorithm: PathfindingAlgorithm,
  maxDistance: S.optional(S.Number.pipe(S.positive)),
  maxIterations: S.optional(S.Number.pipe(S.int(), S.positive)),
  heuristic: S.optional(S.Union(S.Literal('manhattan'), S.Literal('euclidean'), S.Literal('chebyshev'))),
  allowDiagonal: S.Boolean,
  allowJumping: S.Boolean,
  jumpHeight: S.optional(S.Number.pipe(S.positive)),
  entityRadius: S.optional(S.Number.pipe(S.positive)),
}).pipe(S.identifier('PathfindingParams'))
export type PathfindingParams = S.Schema.Type<typeof PathfindingParams>

/**
 * Path result
 */
export const PathResult = S.Struct({
  path: S.Array(Position3D),
  totalCost: S.Number.pipe(S.nonNegative),
  found: S.Boolean,
  nodesVisited: S.Number.pipe(S.int(), S.nonNegative),
  executionTime: S.Number.pipe(S.positive),
}).pipe(S.identifier('PathResult'))
export type PathResult = S.Schema.Type<typeof PathResult>

// ============================================
// Noise Generation Types
// ============================================

/**
 * Noise type enumeration
 */
export const NoiseType = S.Union(
  S.Literal('perlin'),
  S.Literal('simplex'),
  S.Literal('worley'),
  S.Literal('ridged'),
  S.Literal('billow'),
  S.Literal('fbm'), // Fractional Brownian Motion
  S.Literal('turbulence'),
).pipe(S.identifier('NoiseType'))
export type NoiseType = S.Schema.Type<typeof NoiseType>

/**
 * Noise generation parameters
 */
export const NoiseParams = S.Struct({
  type: NoiseType,
  seed: S.Number.pipe(S.int()),
  octaves: S.Number.pipe(S.int(), S.between(1, 8)),
  frequency: S.Number.pipe(S.positive),
  amplitude: S.Number.pipe(S.positive),
  persistence: S.Number.pipe(S.between(0, 1)),
  lacunarity: S.Number.pipe(S.between(1, 4)),
  dimensions: S.Union(S.Literal(1), S.Literal(2), S.Literal(3), S.Literal(4)),
  outputRange: S.optional(
    S.Struct({
      min: S.Number,
      max: S.Number,
    }),
  ),
}).pipe(S.identifier('NoiseParams'))
export type NoiseParams = S.Schema.Type<typeof NoiseParams>

/**
 * Noise sample request
 */
export const NoiseSampleRequest = S.Struct({
  params: NoiseParams,
  samples: S.Union(
    // Single point
    S.Struct({
      type: S.Literal('point'),
      position: S.Union(
        S.Number, // 1D
        S.Struct({ x: S.Number, y: S.Number }), // 2D
        Position3D, // 3D
        S.Struct({ x: S.Number, y: S.Number, z: S.Number, w: S.Number }), // 4D
      ),
    }),
    // Grid of samples
    S.Struct({
      type: S.Literal('grid'),
      origin: Position3D,
      size: Position3D, // Width, height, depth
      resolution: S.Number.pipe(S.positive),
    }),
    // Array of specific points
    S.Struct({
      type: S.Literal('array'),
      points: S.Array(Position3D),
    }),
  ),
}).pipe(S.identifier('NoiseSampleRequest'))
export type NoiseSampleRequest = S.Schema.Type<typeof NoiseSampleRequest>

/**
 * Noise sample result
 */
export const NoiseSampleResult = S.Struct({
  values: S.Array(S.Number),
  dimensions: S.Struct({
    width: S.Number.pipe(S.int(), S.positive),
    height: S.Number.pipe(S.int(), S.positive),
    depth: S.optional(S.Number.pipe(S.int(), S.positive)),
  }),
  statistics: S.optional(
    S.Struct({
      min: S.Number,
      max: S.Number,
      average: S.Number,
      standardDeviation: S.Number,
    }),
  ),
}).pipe(S.identifier('NoiseSampleResult'))
export type NoiseSampleResult = S.Schema.Type<typeof NoiseSampleResult>

// ============================================
// Data Compression Types
// ============================================

/**
 * Compression algorithm
 */
export const CompressionAlgorithm = S.Union(
  S.Literal('gzip'),
  S.Literal('deflate'),
  S.Literal('brotli'),
  S.Literal('lz4'),
  S.Literal('zstd'),
  S.Literal('snappy'),
).pipe(S.identifier('CompressionAlgorithm'))
export type CompressionAlgorithm = S.Schema.Type<typeof CompressionAlgorithm>

/**
 * Compression parameters
 */
export const CompressionParams = S.Struct({
  algorithm: CompressionAlgorithm,
  level: S.Number.pipe(S.int(), S.between(1, 9)),
  chunkSize: S.optional(S.Number.pipe(S.int(), S.positive)),
}).pipe(S.identifier('CompressionParams'))
export type CompressionParams = S.Schema.Type<typeof CompressionParams>

/**
 * Compression request
 */
export const CompressionRequest = S.Struct({
  data: S.Unknown, // ArrayBuffer, TypedArray, or string
  params: CompressionParams,
  inputFormat: S.Union(S.Literal('binary'), S.Literal('text'), S.Literal('json')),
}).pipe(S.identifier('CompressionRequest'))
export type CompressionRequest = S.Schema.Type<typeof CompressionRequest>

/**
 * Compression result
 */
export const CompressionResult = S.Struct({
  compressedData: S.Unknown, // Compressed ArrayBuffer
  originalSize: S.Number.pipe(S.int(), S.nonNegative),
  compressedSize: S.Number.pipe(S.int(), S.nonNegative),
  compressionRatio: S.Number.pipe(S.positive),
  compressionTime: S.Number.pipe(S.positive),
}).pipe(S.identifier('CompressionResult'))
export type CompressionResult = S.Schema.Type<typeof CompressionResult>

// ============================================
// Image Processing Types
// ============================================

/**
 * Image format
 */
export const ImageFormat = S.Union(
  S.Literal('rgba8'),
  S.Literal('rgb8'),
  S.Literal('grayscale8'),
  S.Literal('rgba16f'),
  S.Literal('rgb16f'),
  S.Literal('r32f'),
).pipe(S.identifier('ImageFormat'))
export type ImageFormat = S.Schema.Type<typeof ImageFormat>

/**
 * Image processing operation
 */
export const ImageOperation = S.Union(
  S.Literal('resize'),
  S.Literal('blur'),
  S.Literal('sharpen'),
  S.Literal('edge_detect'),
  S.Literal('emboss'),
  S.Literal('brightness'),
  S.Literal('contrast'),
  S.Literal('saturation'),
  S.Literal('hue_shift'),
  S.Literal('threshold'),
  S.Literal('invert'),
).pipe(S.identifier('ImageOperation'))
export type ImageOperation = S.Schema.Type<typeof ImageOperation>

/**
 * Image data
 */
export const ImageData = S.Struct({
  width: S.Number.pipe(S.int(), S.positive),
  height: S.Number.pipe(S.int(), S.positive),
  format: ImageFormat,
  data: S.Unknown, // TypedArray containing pixel data
}).pipe(S.identifier('ImageData'))
export type ImageData = S.Schema.Type<typeof ImageData>

/**
 * Image processing request
 */
export const ImageProcessingRequest = S.Struct({
  image: ImageData,
  operation: ImageOperation,
  parameters: S.Record({
    key: S.String,
    value: S.Union(S.String, S.Number, S.Boolean),
  }),
}).pipe(S.identifier('ImageProcessingRequest'))
export type ImageProcessingRequest = S.Schema.Type<typeof ImageProcessingRequest>

// ============================================
// Math Operations Types
// ============================================

/**
 * Math operation type
 */
export const MathOperationType = S.Union(
  S.Literal('matrix_multiply'),
  S.Literal('matrix_inverse'),
  S.Literal('fft'),
  S.Literal('ifft'),
  S.Literal('convolution'),
  S.Literal('correlation'),
  S.Literal('polynomial_evaluation'),
  S.Literal('numerical_integration'),
  S.Literal('optimization'),
  S.Literal('linear_solve'),
).pipe(S.identifier('MathOperationType'))
export type MathOperationType = S.Schema.Type<typeof MathOperationType>

/**
 * Matrix data
 */
export const Matrix = S.Struct({
  rows: S.Number.pipe(S.int(), S.positive),
  cols: S.Number.pipe(S.int(), S.positive),
  data: S.Unknown, // Float32Array or Float64Array
}).pipe(S.identifier('Matrix'))
export type Matrix = S.Schema.Type<typeof Matrix>

/**
 * Math operation request
 */
export const MathOperationRequest = S.Struct({
  operation: MathOperationType,
  operands: S.Array(S.Union(Matrix, S.Array(S.Number), S.Number)),
  parameters: S.optional(
    S.Record({
      key: S.String,
      value: S.Union(S.String, S.Number, S.Boolean),
    }),
  ),
}).pipe(S.identifier('MathOperationRequest'))
export type MathOperationRequest = S.Schema.Type<typeof MathOperationRequest>

// ============================================
// Request/Response Messages
// ============================================

/**
 * General computation request
 */
export const ComputationRequest = S.Struct({
  // Request identification
  id: S.String,
  type: ComputationType,
  priority: ComputationPriority,
  
  // Execution preferences
  executionMode: S.optional(ExecutionMode),
  timeout: S.optional(S.Number.pipe(S.positive)),
  
  // Computation-specific payload
  payload: S.Union(
    PathfindingParams, // For pathfinding
    NoiseSampleRequest, // For noise generation
    CompressionRequest, // For compression/decompression
    ImageProcessingRequest, // For image processing
    MathOperationRequest, // For math operations
    S.Unknown, // For custom operations
  ),
  
  // Navigation mesh (for pathfinding)
  navigationMesh: S.optional(S.Array(NavigationNode)),
  
  // Options
  options: S.optional(
    S.Struct({
      enableProfiling: S.Boolean,
      returnIntermediateResults: S.Boolean,
      useCache: S.Boolean,
      cacheTTL: S.optional(S.Number.pipe(S.positive)),
      
      // Threading options
      maxThreads: S.optional(S.Number.pipe(S.int(), S.positive)),
      
      // Memory options
      maxMemoryUsage: S.optional(S.Number.pipe(S.positive)),
      
      // Progress reporting
      reportProgress: S.optional(S.Boolean),
      progressInterval: S.optional(S.Number.pipe(S.positive)),
    }),
  ),
}).pipe(S.identifier('ComputationRequest'))
export type ComputationRequest = S.Schema.Type<typeof ComputationRequest>

/**
 * Computation performance metrics
 */
export const ComputationPerformanceMetrics = S.Struct({
  // Timing
  totalTime: S.Number.pipe(S.positive),
  computationTime: S.Number.pipe(S.positive),
  setupTime: S.Number.pipe(S.positive),
  teardownTime: S.Number.pipe(S.positive),
  
  // Resource usage
  peakMemoryUsage: S.optional(S.Number.pipe(S.positive)),
  averageMemoryUsage: S.optional(S.Number.pipe(S.positive)),
  cpuUtilization: S.optional(S.Number.pipe(S.between(0, 100))),
  
  // Threading
  threadsUsed: S.Number.pipe(S.int(), S.nonNegative),
  
  // Operations
  operationsPerformed: S.optional(S.Number.pipe(S.int(), S.nonNegative)),
  throughput: S.optional(S.Number.pipe(S.positive)), // Operations per second
  
  // Cache statistics
  cacheHits: S.optional(S.Number.pipe(S.int(), S.nonNegative)),
  cacheMisses: S.optional(S.Number.pipe(S.int(), S.nonNegative)),
  
  // Quality metrics
  accuracy: S.optional(S.Number.pipe(S.between(0, 1))),
  convergence: S.optional(S.Boolean),
}).pipe(S.identifier('ComputationPerformanceMetrics'))
export type ComputationPerformanceMetrics = S.Schema.Type<typeof ComputationPerformanceMetrics>

/**
 * Computation response
 */
export const ComputationResponse = S.Struct({
  // Request identification
  id: S.String,
  type: ComputationType,
  
  // Result data
  result: S.Union(
    PathResult, // For pathfinding
    NoiseSampleResult, // For noise generation
    CompressionResult, // For compression
    ImageData, // For image processing
    Matrix, // For math operations
    S.Unknown, // For custom operations
  ),
  
  // Performance metrics
  metrics: ComputationPerformanceMetrics,
  
  // Status information
  success: S.Boolean,
  warnings: S.optional(S.Array(S.String)),
  errors: S.optional(S.Array(S.String)),
  
  // Worker information
  workerId: S.String,
  executionMode: ExecutionMode,
  
  // Progress information (if requested)
  progress: S.optional(
    S.Struct({
      percentage: S.Number.pipe(S.between(0, 100)),
      stage: S.String,
      estimatedTimeRemaining: S.optional(S.Number.pipe(S.positive)),
    }),
  ),
  
  // Debug information
  debugData: S.optional(
    S.Struct({
      intermediateResults: S.optional(S.Array(S.Unknown)),
      profilerData: S.optional(S.Unknown),
      memoryBreakdown: S.optional(
        S.Record({
          key: S.String,
          value: S.Number.pipe(S.positive),
        }),
      ),
    }),
  ),
}).pipe(S.identifier('ComputationResponse'))
export type ComputationResponse = S.Schema.Type<typeof ComputationResponse>

// ============================================
// Batch Processing
// ============================================

/**
 * Batch computation request
 */
export const BatchComputationRequest = S.Struct({
  requests: S.Array(ComputationRequest),
  
  // Batch options
  options: S.optional(
    S.Struct({
      maxConcurrent: S.Number.pipe(S.int(), S.positive),
      priority: ComputationPriority,
      timeout: S.Number.pipe(S.positive),
      stopOnFirstError: S.Boolean,
      enableDependencies: S.Boolean,
    }),
  ),
  
  // Dependencies between requests (if enabled)
  dependencies: S.optional(
    S.Array(
      S.Struct({
        requestId: S.String,
        dependsOn: S.Array(S.String),
      }),
    ),
  ),
}).pipe(S.identifier('BatchComputationRequest'))
export type BatchComputationRequest = S.Schema.Type<typeof BatchComputationRequest>

/**
 * Batch computation response
 */
export const BatchComputationResponse = S.Struct({
  responses: S.Array(ComputationResponse),
  
  // Batch metrics
  batchMetrics: S.Struct({
    totalTime: S.Number.pipe(S.positive),
    successCount: S.Number.pipe(S.int(), S.nonNegative),
    failureCount: S.Number.pipe(S.int(), S.nonNegative),
    averageProcessingTime: S.Number.pipe(S.positive),
    concurrencyAchieved: S.Number.pipe(S.int(), S.positive),
  }),
  
  // Failed requests
  failures: S.optional(
    S.Array(
      S.Struct({
        requestIndex: S.Number.pipe(S.int(), S.nonNegative),
        requestId: S.String,
        error: S.String,
      }),
    ),
  ),
}).pipe(S.identifier('BatchComputationResponse'))
export type BatchComputationResponse = S.Schema.Type<typeof BatchComputationResponse>

// ============================================
// Utility Functions
// ============================================

/**
 * Create default pathfinding parameters
 */
export const createDefaultPathfindingParams = (start: Position3D, goal: Position3D): PathfindingParams => ({
  start,
  goal,
  algorithm: 'a_star',
  maxDistance: 1000,
  maxIterations: 10000,
  heuristic: 'euclidean',
  allowDiagonal: true,
  allowJumping: false,
  jumpHeight: 1.0,
  entityRadius: 0.5,
})

/**
 * Create default noise parameters
 */
export const createDefaultNoiseParams = (seed: number = 12345): NoiseParams => ({
  type: 'perlin',
  seed,
  octaves: 4,
  frequency: 0.01,
  amplitude: 1.0,
  persistence: 0.5,
  lacunarity: 2.0,
  dimensions: 2,
  outputRange: { min: 0, max: 1 },
})

/**
 * Create default compression parameters
 */
export const createDefaultCompressionParams = (): CompressionParams => ({
  algorithm: 'gzip',
  level: 6,
  chunkSize: 8192,
})

/**
 * Calculate distance between two 3D points
 */
export const distance3D = (a: Position3D, b: Position3D): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * Calculate Manhattan distance between two 3D points
 */
export const manhattanDistance3D = (a: Position3D, b: Position3D): number => {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)
}

/**
 * Extract transferable objects from computation data
 */
export const extractComputationTransferables = (data: any): ArrayBufferView[] => {
  const transferables: ArrayBufferView[] = []
  
  const extract = (obj: any) => {
    if (obj instanceof ArrayBufferView) {
      transferables.push(obj)
    } else if (obj && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        obj.forEach(extract)
      } else {
        Object.values(obj).forEach(extract)
      }
    }
  }
  
  extract(data)
  return transferables
}

/**
 * Validate computation request
 */
export const validateComputationRequest = (request: unknown) => S.decodeUnknown(ComputationRequest)(request)

/**
 * Validate computation response
 */
export const validateComputationResponse = (response: unknown) => S.decodeUnknown(ComputationResponse)(response)