import * as S from 'effect/Schema'
import { ChunkCoordinatesSchema } from '@domain/value-objects/coordinates'
import { Position3D, Block, ChunkData } from '@infrastructure/workers/unified/protocols/terrain.protocol'

/**
 * Lighting Calculation Protocol
 * Type-safe message schemas for lighting worker communication
 */

// ============================================
// Base Lighting Types
// ============================================

/**
 * Light type enumeration
 */
export const LightType = S.Union(
  S.Literal('sunlight'),
  S.Literal('block_light'),
  S.Literal('torch'),
  S.Literal('lava'),
  S.Literal('glowstone'),
  S.Literal('redstone'),
  S.Literal('beacon'),
  S.Literal('sea_lantern'),
  S.Literal('end_rod'),
  S.Literal('fire'),
  S.Literal('jack_o_lantern'),
).pipe(S.identifier('LightType'))
export type LightType = S.Schema.Type<typeof LightType>

/**
 * Light source definition
 */
export const LightSource = S.Struct({
  position: Position3D,
  type: LightType,
  intensity: S.Number.pipe(S.between(0, 15)),
  color: S.optional(
    S.Struct({
      r: S.Number.pipe(S.between(0, 1)),
      g: S.Number.pipe(S.between(0, 1)),
      b: S.Number.pipe(S.between(0, 1)),
    }),
  ),
  radius: S.Number.pipe(S.positive),
  falloffType: S.Union(S.Literal('linear'), S.Literal('quadratic'), S.Literal('cubic')),
  castsShadows: S.Boolean,
  isDirectional: S.Boolean,
  direction: S.optional(Position3D),
}).pipe(S.identifier('LightSource'))
export type LightSource = S.Schema.Type<typeof LightSource>

/**
 * Ambient lighting settings
 */
export const AmbientLighting = S.Struct({
  skyLightLevel: S.Number.pipe(S.between(0, 15)),
  blockLightLevel: S.Number.pipe(S.between(0, 15)),
  worldTime: S.Number.pipe(S.between(0, 24000)), // Minecraft time units
  weatherCondition: S.Union(S.Literal('clear'), S.Literal('rain'), S.Literal('thunder')),
  fogDensity: S.optional(S.Number.pipe(S.between(0, 1))),
  skyColor: S.optional(
    S.Struct({
      r: S.Number.pipe(S.between(0, 1)),
      g: S.Number.pipe(S.between(0, 1)),
      b: S.Number.pipe(S.between(0, 1)),
    }),
  ),
}).pipe(S.identifier('AmbientLighting'))
export type AmbientLighting = S.Schema.Type<typeof AmbientLighting>

/**
 * Shadow configuration
 */
export const ShadowSettings = S.Struct({
  enableShadows: S.Boolean,
  shadowResolution: S.Number.pipe(S.int(), S.positive),
  shadowDistance: S.Number.pipe(S.positive),
  cascadedShadowMaps: S.Boolean,
  shadowMapCascades: S.optional(S.Array(S.Number.pipe(S.positive))),
  shadowBias: S.Number.pipe(S.between(0, 1)),
  shadowSoftness: S.Number.pipe(S.between(0, 1)),
}).pipe(S.identifier('ShadowSettings'))
export type ShadowSettings = S.Schema.Type<typeof ShadowSettings>

/**
 * Ambient occlusion settings
 */
export const AmbientOcclusionSettings = S.Struct({
  enableAO: S.Boolean,
  aoSamples: S.Number.pipe(S.int(), S.positive),
  aoRadius: S.Number.pipe(S.positive),
  aoIntensity: S.Number.pipe(S.between(0, 1)),
  aoFalloff: S.Number.pipe(S.positive),
  aoQuality: S.Union(S.Literal('low'), S.Literal('medium'), S.Literal('high'), S.Literal('ultra')),
}).pipe(S.identifier('AmbientOcclusionSettings'))
export type AmbientOcclusionSettings = S.Schema.Type<typeof AmbientOcclusionSettings>

// ============================================
// Light Map Data Types
// ============================================

/**
 * Block light data
 */
export const BlockLightData = S.Struct({
  position: Position3D,
  lightLevel: S.Number.pipe(S.between(0, 15)),
  sourceType: LightType,
  propagationDistance: S.Number.pipe(S.int(), S.nonNegative),
}).pipe(S.identifier('BlockLightData'))
export type BlockLightData = S.Schema.Type<typeof BlockLightData>

/**
 * Sky light data
 */
export const SkyLightData = S.Struct({
  position: Position3D,
  skyLightLevel: S.Number.pipe(S.between(0, 15)),
  isDirectSunlight: S.Boolean,
  occlusionFactor: S.Number.pipe(S.between(0, 1)),
}).pipe(S.identifier('SkyLightData'))
export type SkyLightData = S.Schema.Type<typeof SkyLightData>

/**
 * Combined lighting data for a single block
 */
export const BlockLighting = S.Struct({
  position: Position3D,
  skyLight: S.Number.pipe(S.between(0, 15)),
  blockLight: S.Number.pipe(S.between(0, 15)),
  combinedLight: S.Number.pipe(S.between(0, 15)),
  ambientOcclusion: S.optional(S.Number.pipe(S.between(0, 1))),
  shadowFactor: S.optional(S.Number.pipe(S.between(0, 1))),
  colorTemperature: S.optional(S.Number.pipe(S.positive)),
}).pipe(S.identifier('BlockLighting'))
export type BlockLighting = S.Schema.Type<typeof BlockLighting>

/**
 * Lightmap texture data (for advanced rendering)
 */
export const LightmapData = S.Struct({
  width: S.Number.pipe(S.int(), S.positive),
  height: S.Number.pipe(S.int(), S.positive),
  format: S.Union(S.Literal('rgb8'), S.Literal('rgba8'), S.Literal('rgb16f'), S.Literal('rgba16f')),
  data: S.Unknown, // Typed array containing lightmap texel data
  uvMapping: S.Array(
    S.Struct({
      blockPosition: Position3D,
      uvMin: S.Struct({ u: S.Number, v: S.Number }),
      uvMax: S.Struct({ u: S.Number, v: S.Number }),
    }),
  ),
}).pipe(S.identifier('LightmapData'))
export type LightmapData = S.Schema.Type<typeof LightmapData>

// ============================================
// Request/Response Messages
// ============================================

/**
 * Neighboring chunks for seamless lighting calculation
 */
export const NeighborLightingData = S.Struct({
  north: S.optional(S.Array(BlockLighting)),
  south: S.optional(S.Array(BlockLighting)),
  east: S.optional(S.Array(BlockLighting)),
  west: S.optional(S.Array(BlockLighting)),
  northeast: S.optional(S.Array(BlockLighting)),
  northwest: S.optional(S.Array(BlockLighting)),
  southeast: S.optional(S.Array(BlockLighting)),
  southwest: S.optional(S.Array(BlockLighting)),
  up: S.optional(S.Array(BlockLighting)),
  down: S.optional(S.Array(BlockLighting)),
}).pipe(S.identifier('NeighborLightingData'))
export type NeighborLightingData = S.Schema.Type<typeof NeighborLightingData>

/**
 * Lighting calculation request
 */
export const LightingCalculationRequest = S.Struct({
  // Chunk data to calculate lighting for
  chunkData: ChunkData,
  coordinates: ChunkCoordinatesSchema,

  // Neighboring chunk lighting data for seamless calculation
  neighbors: S.optional(NeighborLightingData),

  // Light sources in and around the chunk
  lightSources: S.Array(LightSource),

  // Ambient lighting conditions
  ambientLighting: AmbientLighting,

  // Shadow settings
  shadows: S.optional(ShadowSettings),

  // Ambient occlusion settings
  ambientOcclusion: S.optional(AmbientOcclusionSettings),

  // Calculation options
  options: S.optional(
    S.Struct({
      // Lighting calculation method
      calculationMethod: S.Union(S.Literal('flood_fill'), S.Literal('raycast'), S.Literal('hybrid')),

      // Quality settings
      lightPropagationSteps: S.Number.pipe(S.int(), S.positive),
      enableSmoothLighting: S.Boolean,
      enableColoredLighting: S.Boolean,

      // Performance options
      maxLightSources: S.Number.pipe(S.int(), S.positive),
      enableLightCaching: S.Boolean,
      enableMultithreading: S.Boolean,

      // Output options
      generateLightmap: S.Boolean,
      lightmapResolution: S.optional(S.Number.pipe(S.int(), S.positive)),
      includeDebugInfo: S.Boolean,
    }),
  ),
}).pipe(S.identifier('LightingCalculationRequest'))
export type LightingCalculationRequest = S.Schema.Type<typeof LightingCalculationRequest>

/**
 * Chunk lighting data output
 */
export const ChunkLightingData = S.Struct({
  coordinates: ChunkCoordinatesSchema,
  blockLighting: S.Array(BlockLighting),

  // Separate light maps for different types
  skyLightMap: S.Array(S.Number.pipe(S.between(0, 15))),
  blockLightMap: S.Array(S.Number.pipe(S.between(0, 15))),
  combinedLightMap: S.Array(S.Number.pipe(S.between(0, 15))),

  // Optional advanced data
  ambientOcclusionMap: S.optional(S.Array(S.Number.pipe(S.between(0, 1)))),
  shadowMap: S.optional(S.Array(S.Number.pipe(S.between(0, 1)))),

  // Lightmap texture (if requested)
  lightmap: S.optional(LightmapData),

  // Edge data for neighboring chunks
  edgeLighting: S.Struct({
    north: S.Array(BlockLighting),
    south: S.Array(BlockLighting),
    east: S.Array(BlockLighting),
    west: S.Array(BlockLighting),
  }),

  // Metadata
  calculationTime: S.Number.pipe(S.positive),
  lightSourceCount: S.Number.pipe(S.int(), S.nonNegative),
  timestamp: S.Number.pipe(S.positive),
}).pipe(S.identifier('ChunkLightingData'))
export type ChunkLightingData = S.Schema.Type<typeof ChunkLightingData>

/**
 * Lighting calculation performance metrics
 */
export const LightingPerformanceMetrics = S.Struct({
  // Timing
  totalTime: S.Number.pipe(S.positive),
  propagationTime: S.Number.pipe(S.positive),
  shadowCalculationTime: S.optional(S.Number.pipe(S.positive)),
  ambientOcclusionTime: S.optional(S.Number.pipe(S.positive)),
  lightmapGenerationTime: S.optional(S.Number.pipe(S.positive)),

  // Processing statistics
  blocksProcessed: S.Number.pipe(S.int(), S.nonNegative),
  lightSourcesProcessed: S.Number.pipe(S.int(), S.nonNegative),
  propagationSteps: S.Number.pipe(S.int(), S.nonNegative),

  // Quality metrics
  lightingAccuracy: S.optional(S.Number.pipe(S.between(0, 1))),
  shadowQuality: S.optional(S.Number.pipe(S.between(0, 1))),

  // Memory usage
  peakMemoryUsage: S.optional(S.Number.pipe(S.positive)),
  cacheHitRate: S.optional(S.Number.pipe(S.between(0, 1))),

  // Optimization results
  lightSourcesCulled: S.Number.pipe(S.int(), S.nonNegative),
  blocksCulled: S.Number.pipe(S.int(), S.nonNegative),
}).pipe(S.identifier('LightingPerformanceMetrics'))
export type LightingPerformanceMetrics = S.Schema.Type<typeof LightingPerformanceMetrics>

/**
 * Lighting calculation response
 */
export const LightingCalculationResponse = S.Struct({
  // Calculated lighting data
  lightingData: ChunkLightingData,

  // Performance metrics
  metrics: LightingPerformanceMetrics,

  // Status information
  success: S.Boolean,
  warnings: S.optional(S.Array(S.String)),
  errors: S.optional(S.Array(S.String)),

  // Worker information
  workerId: S.String,
  calculationMethod: S.Union(S.Literal('flood_fill'), S.Literal('raycast'), S.Literal('hybrid')),

  // Debug information
  debugData: S.optional(
    S.Struct({
      lightPropagationPaths: S.optional(S.Array(S.Array(Position3D))),
      shadowRays: S.optional(S.Array(S.Struct({ origin: Position3D, direction: Position3D, hit: S.Boolean }))),
      performanceBreakdown: S.optional(
        S.Record({
          key: S.String,
          value: S.Number.pipe(S.positive),
        }),
      ),
    }),
  ),
}).pipe(S.identifier('LightingCalculationResponse'))
export type LightingCalculationResponse = S.Schema.Type<typeof LightingCalculationResponse>

// ============================================
// Batch Processing
// ============================================

/**
 * Batch lighting calculation request
 */
export const BatchLightingCalculationRequest = S.Struct({
  requests: S.Array(LightingCalculationRequest),

  // Global lighting settings that apply to all requests
  globalAmbientLighting: AmbientLighting,
  globalShadowSettings: S.optional(ShadowSettings),
  globalAOSettings: S.optional(AmbientOcclusionSettings),

  // Batch options
  options: S.optional(
    S.Struct({
      maxConcurrent: S.Number.pipe(S.int(), S.positive),
      priority: S.Number.pipe(S.int(), S.between(0, 10)),
      timeout: S.Number.pipe(S.positive),
      enableInterChunkOptimization: S.Boolean,
    }),
  ),
}).pipe(S.identifier('BatchLightingCalculationRequest'))
export type BatchLightingCalculationRequest = S.Schema.Type<typeof BatchLightingCalculationRequest>

/**
 * Batch lighting calculation response
 */
export const BatchLightingCalculationResponse = S.Struct({
  responses: S.Array(LightingCalculationResponse),

  // Batch metrics
  batchMetrics: S.Struct({
    totalTime: S.Number.pipe(S.positive),
    successCount: S.Number.pipe(S.int(), S.nonNegative),
    failureCount: S.Number.pipe(S.int(), S.nonNegative),
    averageProcessingTime: S.Number.pipe(S.positive),
    totalBlocksProcessed: S.Number.pipe(S.int(), S.nonNegative),
  }),

  // Failed requests
  failures: S.optional(
    S.Array(
      S.Struct({
        requestIndex: S.Number.pipe(S.int(), S.nonNegative),
        error: S.String,
        coordinates: ChunkCoordinatesSchema,
      }),
    ),
  ),
}).pipe(S.identifier('BatchLightingCalculationResponse'))
export type BatchLightingCalculationResponse = S.Schema.Type<typeof BatchLightingCalculationResponse>

// ============================================
// Utility Functions
// ============================================

/**
 * Create default ambient lighting
 */
export const createDefaultAmbientLighting = (): AmbientLighting => ({
  skyLightLevel: 15,
  blockLightLevel: 0,
  worldTime: 6000, // Noon
  weatherCondition: 'clear',
  fogDensity: 0.1,
  skyColor: { r: 0.5, g: 0.7, b: 1.0 },
})

/**
 * Create default shadow settings
 */
export const createDefaultShadowSettings = (): ShadowSettings => ({
  enableShadows: true,
  shadowResolution: 2048,
  shadowDistance: 100.0,
  cascadedShadowMaps: true,
  shadowMapCascades: [8.0, 25.0, 50.0, 100.0],
  shadowBias: 0.001,
  shadowSoftness: 0.5,
})

/**
 * Create default ambient occlusion settings
 */
export const createDefaultAOSettings = (): AmbientOcclusionSettings => ({
  enableAO: true,
  aoSamples: 16,
  aoRadius: 1.0,
  aoIntensity: 0.8,
  aoFalloff: 1.0,
  aoQuality: 'medium',
})

/**
 * Calculate light attenuation based on distance
 */
export const calculateLightAttenuation = (intensity: number, distance: number, falloffType: LightSource['falloffType']): number => {
  if (distance === 0) return intensity

  switch (falloffType) {
    case 'linear':
      return Math.max(0, intensity - distance)
    case 'quadratic':
      return intensity / (1 + distance * distance)
    case 'cubic':
      return intensity / (1 + distance * distance * distance)
    default:
      return intensity
  }
}

/**
 * Convert world time to light level
 */
export const worldTimeToSkyLight = (worldTime: number): number => {
  // Normalize time to 0-1 range (0 = midnight, 0.5 = noon)
  const normalizedTime = (worldTime % 24000) / 24000

  // Simple day/night cycle
  if (normalizedTime < 0.25 || normalizedTime > 0.75) {
    // Night time
    return 0
  } else if (normalizedTime >= 0.4 && normalizedTime <= 0.6) {
    // Full daylight
    return 15
  } else {
    // Dawn/dusk transition
    const transitionFactor =
      normalizedTime < 0.4
        ? (normalizedTime - 0.25) / 0.15 // Dawn
        : (0.75 - normalizedTime) / 0.15 // Dusk
    return Math.round(transitionFactor * 15)
  }
}

/**
 * Create transferable lightmap data
 */
export const createTransferableLightmapData = (width: number, height: number, lightData: number[], format: LightmapData['format'] = 'rgb8'): LightmapData => {
  let data: ArrayBufferView

  switch (format) {
    case 'rgb8':
      data = new Uint8Array(lightData.map((v) => Math.round(v * 255)))
      break
    case 'rgba8':
      data = new Uint8Array(lightData.map((v) => Math.round(v * 255)))
      break
    case 'rgb16f':
      data = new Float32Array(lightData)
      break
    case 'rgba16f':
      data = new Float32Array(lightData)
      break
    default:
      data = new Uint8Array(lightData.map((v) => Math.round(v * 255)))
  }

  return {
    width,
    height,
    format,
    data,
    uvMapping: [],
  }
}

/**
 * Extract transferable objects from lighting data
 */
export const extractLightingTransferables = (lightingData: ChunkLightingData): ArrayBufferView[] => {
  const transferables: ArrayBufferView[] = []

  // Extract lightmap data if present
  if (lightingData.lightmap && lightingData.lightmap.data instanceof ArrayBufferView) {
    transferables.push(lightingData.lightmap.data)
  }

  return transferables
}

/**
 * Validate lighting calculation request
 */
export const validateLightingRequest = (request: unknown) => S.decodeUnknown(LightingCalculationRequest)(request)

/**
 * Validate lighting calculation response
 */
export const validateLightingResponse = (response: unknown) => S.decodeUnknown(LightingCalculationResponse)(response)
