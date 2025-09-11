/**
 * Optimization Domain Service
 *
 * Contains pure domain logic for rendering and performance optimization strategies.
 * This service defines business rules for LOD (Level of Detail), culling, batching,
 * and other optimization techniques without dependencies on specific rendering libraries.
 */

import { Effect, Context, Layer } from 'effect'
import type { EntityId } from '@domain/entities'

/**
 * Level of Detail (LOD) configuration
 */
export interface LODLevel {
  readonly distance: number
  readonly detailMultiplier: number // 0.0 to 1.0
  readonly triangleReduction: number // 0.0 to 1.0
  readonly textureResolution: number // 0.0 to 1.0
}

export interface LODConfiguration {
  readonly entityId: EntityId
  readonly levels: readonly LODLevel[]
  readonly currentLevel: number
  readonly hysteresis: number // Distance buffer to prevent LOD flickering
  readonly enabled: boolean
}

/**
 * Culling strategies and configuration
 */
export type CullingType = 'frustum' | 'occlusion' | 'distance' | 'backface' | 'small_feature'

export interface CullingConfiguration {
  readonly type: CullingType
  readonly enabled: boolean
  readonly parameters: Readonly<Record<string, number>>
  readonly priority: number // Higher priority culling runs first
}

export interface CullingResult {
  readonly entityId: EntityId
  readonly culled: boolean
  readonly reason: CullingType
  readonly distance?: number
  readonly occluded?: boolean
  readonly outsideFrustum?: boolean
}

/**
 * Batching and instancing configuration
 */
export interface BatchingStrategy {
  readonly type: 'static' | 'dynamic' | 'instanced'
  readonly maxBatchSize: number
  readonly geometryCompatibility: 'exact' | 'similar' | 'mergeable'
  readonly materialCompatibility: 'exact' | 'compatible'
  readonly sortingCriteria: readonly ('distance' | 'material' | 'geometry' | 'transparency')[]
}

export interface RenderBatch {
  readonly id: string
  readonly entities: readonly EntityId[]
  readonly strategy: BatchingStrategy
  readonly estimatedTriangles: number
  readonly estimatedDrawCalls: number
  readonly priority: number
  readonly isDynamic: boolean
}

/**
 * Optimization metrics and targets
 */
export interface OptimizationTargets {
  readonly targetFPS: number
  readonly maxDrawCalls: number
  readonly maxTriangles: number
  readonly maxMemoryUsage: number // bytes
  readonly maxInstancesPerBatch: number
  readonly lodBias: number // -1.0 to 1.0, negative for more aggressive LOD
}

export interface OptimizationMetrics {
  readonly currentFPS: number
  readonly drawCalls: number
  readonly triangles: number
  readonly memoryUsage: number
  readonly culledObjects: number
  readonly batchedObjects: number
  readonly lodTransitions: number
}

/**
 * Optimization decision
 */
export interface OptimizationDecision {
  readonly strategy: string
  readonly entities: readonly EntityId[]
  readonly expectedImprovement: {
    readonly fpsGain: number
    readonly drawCallReduction: number
    readonly memoryReduction: number
  }
  readonly cost: {
    readonly cpuOverhead: number
    readonly memoryOverhead: number
    readonly qualityLoss: number // 0.0 to 1.0
  }
  readonly priority: number
}

/**
 * Spatial optimization data
 */
export interface SpatialOptimizationData {
  readonly entityId: EntityId
  readonly position: readonly [number, number, number]
  readonly bounds: {
    readonly min: readonly [number, number, number]
    readonly max: readonly [number, number, number]
  }
  readonly radius: number
  readonly lastVisible: number
  readonly visibilityFrequency: number
}

/**
 * Quality settings for dynamic adjustment
 */
export interface QualitySettings {
  readonly renderDistance: number
  readonly shadowQuality: 'off' | 'low' | 'medium' | 'high'
  readonly textureQuality: 'low' | 'medium' | 'high' | 'ultra'
  readonly shaderComplexity: 'basic' | 'standard' | 'advanced'
  readonly antiAliasing: 'off' | 'fxaa' | 'msaa2x' | 'msaa4x'
  readonly postProcessing: 'off' | 'basic' | 'full'
}

/**
 * Domain errors
 */
export class OptimizationError extends Error {
  readonly _tag = 'OptimizationError'
  constructor(public readonly reason: string) {
    super(`Optimization failed: ${reason}`)
  }
}

export class LODConfigurationError extends Error {
  readonly _tag = 'LODConfigurationError'
  constructor(public readonly reason: string) {
    super(`LOD configuration error: ${reason}`)
  }
}

export class CullingError extends Error {
  readonly _tag = 'CullingError'
  constructor(public readonly reason: string) {
    super(`Culling error: ${reason}`)
  }
}

/**
 * Optimization constants and defaults
 */
export const OPTIMIZATION_CONSTANTS = {
  LOD: {
    DEFAULT_LEVELS: [
      { distance: 0, detailMultiplier: 1.0, triangleReduction: 0.0, textureResolution: 1.0 },
      { distance: 50, detailMultiplier: 0.75, triangleReduction: 0.25, textureResolution: 0.75 },
      { distance: 100, detailMultiplier: 0.5, triangleReduction: 0.5, textureResolution: 0.5 },
      { distance: 200, detailMultiplier: 0.25, triangleReduction: 0.75, textureResolution: 0.25 },
      { distance: 400, detailMultiplier: 0.1, triangleReduction: 0.9, textureResolution: 0.1 },
    ] as const,
    HYSTERESIS_FACTOR: 0.1, // 10% distance buffer
    MAX_LOD_TRANSITIONS_PER_FRAME: 10,
  },

  CULLING: {
    FRUSTUM_MARGIN: 1.1, // 10% margin to prevent edge popping
    OCCLUSION_QUERY_DELAY: 2, // Frames to wait before querying occlusion
    DISTANCE_CULLING_FACTOR: 1.5, // Multiplier for render distance
    SMALL_FEATURE_THRESHOLD: 0.001, // Screen space size threshold
  },

  BATCHING: {
    MAX_BATCH_SIZE: 1000,
    MAX_INSTANCES: 65536,
    GEOMETRY_SIMILARITY_THRESHOLD: 0.8,
    MATERIAL_COMPATIBILITY_SCORE: 0.9,
    DYNAMIC_BATCH_UPDATE_THRESHOLD: 10, // Minimum changes to rebuild batch
  },

  PERFORMANCE: {
    TARGET_FPS: 60,
    FRAME_TIME_BUDGET: 16.67, // ms for 60fps
    LOD_UPDATE_INTERVAL: 100, // ms
    CULLING_UPDATE_INTERVAL: 16, // ms
    BATCH_REBUILD_INTERVAL: 500, // ms
  },
} as const

/**
 * Pure domain functions for optimization
 */

const calculateLODLevel = (distance: number, levels: readonly LODLevel[], currentLevel: number, hysteresis: number): number => {
  const sortedLevels = [...levels].sort((a, b) => a.distance - b.distance)

  // Apply hysteresis to prevent flickering
  const hysteresisDistance = distance * (1 + (currentLevel > 0 ? -hysteresis : hysteresis))

  for (let i = sortedLevels.length - 1; i >= 0; i--) {
    if (hysteresisDistance >= sortedLevels[i].distance) {
      return i
    }
  }

  return 0
}

const evaluateCullingStrategy = (
  cullingConfig: CullingConfiguration,
  spatialData: SpatialOptimizationData,
  viewerPosition: readonly [number, number, number],
  frustumPlanes?: readonly number[][],
  occluders?: readonly SpatialOptimizationData[],
): CullingResult => {
  const entityId = spatialData.entityId

  switch (cullingConfig.type) {
    case 'frustum':
      // Simplified frustum culling logic (would use actual frustum planes)
      const inFrustum = frustumPlanes ? true : true // Placeholder
      return {
        entityId,
        culled: !inFrustum,
        reason: 'frustum',
        outsideFrustum: !inFrustum,
      }

    case 'distance': {
      const dx = spatialData.position[0] - viewerPosition[0]
      const dy = spatialData.position[1] - viewerPosition[1]
      const dz = spatialData.position[2] - viewerPosition[2]
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

      const maxDistance = cullingConfig.parameters.maxDistance || Infinity
      const culled = distance > maxDistance

      return {
        entityId,
        culled,
        reason: 'distance',
        distance,
      }
    }

    case 'occlusion': {
      // Simplified occlusion culling (would use actual occlusion queries)
      const occluded = false // Placeholder
      return {
        entityId,
        culled: occluded,
        reason: 'occlusion',
        occluded,
      }
    }

    case 'small_feature': {
      // Cull objects that would be too small to see
      const distance = Math.sqrt(
        Math.pow(spatialData.position[0] - viewerPosition[0], 2) +
          Math.pow(spatialData.position[1] - viewerPosition[1], 2) +
          Math.pow(spatialData.position[2] - viewerPosition[2], 2),
      )

      const screenSize = spatialData.radius / distance
      const threshold = cullingConfig.parameters.screenSizeThreshold || OPTIMIZATION_CONSTANTS.CULLING.SMALL_FEATURE_THRESHOLD

      return {
        entityId,
        culled: screenSize < threshold,
        reason: 'small_feature',
        distance,
      }
    }

    default:
      return {
        entityId,
        culled: false,
        reason: cullingConfig.type,
      }
  }
}

const createOptimalBatches = (entities: readonly EntityId[], spatialData: readonly SpatialOptimizationData[], strategy: BatchingStrategy): readonly RenderBatch[] => {
  const batches: RenderBatch[] = []
  const entityMap = new Map(spatialData.map((data) => [data.entityId, data]))

  // Group entities by compatibility
  const groups = new Map<string, EntityId[]>()

  for (const entityId of entities) {
    // Simplified grouping logic (would use actual geometry/material analysis)
    const groupKey = `group-${Math.floor(Math.random() * 10)}` // Placeholder

    if (!groups.has(groupKey)) {
      groups.set(groupKey, [])
    }
    groups.get(groupKey)!.push(entityId)
  }

  // Create batches from groups
  let batchId = 0
  for (const [groupKey, groupEntities] of groups) {
    const chunks = chunkArray(groupEntities, strategy.maxBatchSize)

    for (const chunk of chunks) {
      const batch: RenderBatch = {
        id: `batch-${batchId++}`,
        entities: chunk,
        strategy,
        estimatedTriangles: chunk.length * 100, // Simplified estimation
        estimatedDrawCalls: strategy.type === 'instanced' ? 1 : chunk.length,
        priority: calculateBatchPriority(chunk, entityMap),
        isDynamic: strategy.type === 'dynamic',
      }

      batches.push(batch)
    }
  }

  return batches.sort((a, b) => b.priority - a.priority)
}

const chunkArray = <T>(array: readonly T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

const calculateBatchPriority = (entities: readonly EntityId[], entityMap: Map<EntityId, SpatialOptimizationData>): number => {
  // Higher priority for frequently visible, closer objects
  let totalPriority = 0

  for (const entityId of entities) {
    const data = entityMap.get(entityId)
    if (data) {
      // Closer objects get higher priority
      const distanceFactor = 1.0 / (1.0 + Math.sqrt(data.position[0] * data.position[0] + data.position[1] * data.position[1] + data.position[2] * data.position[2]) / 100)

      // More frequently visible objects get higher priority
      const visibilityFactor = data.visibilityFrequency

      totalPriority += distanceFactor * visibilityFactor
    }
  }

  return totalPriority / entities.length
}

const calculateOptimizationImpact = (decision: OptimizationDecision, currentMetrics: OptimizationMetrics, targets: OptimizationTargets): number => {
  const fpsImprovement = decision.expectedImprovement.fpsGain / (targets.targetFPS - currentMetrics.currentFPS || 1)
  const drawCallReduction = decision.expectedImprovement.drawCallReduction / currentMetrics.drawCalls
  const memoryReduction = decision.expectedImprovement.memoryReduction / currentMetrics.memoryUsage

  const qualityCost = decision.cost.qualityLoss
  const performanceCost = (decision.cost.cpuOverhead + decision.cost.memoryOverhead) / 2

  const benefit = (fpsImprovement + drawCallReduction + memoryReduction) / 3
  const cost = (qualityCost + performanceCost) / 2

  return Math.max(0, benefit - cost)
}

const adjustQualitySettings = (currentSettings: QualitySettings, currentMetrics: OptimizationMetrics, targets: OptimizationTargets): QualitySettings => {
  const fpsRatio = currentMetrics.currentFPS / targets.targetFPS

  if (fpsRatio < 0.8) {
    // Performance is poor, reduce quality
    return {
      ...currentSettings,
      renderDistance: Math.max(8, currentSettings.renderDistance * 0.9),
      shadowQuality: downgradeSetting(currentSettings.shadowQuality, ['off', 'low', 'medium', 'high']),
      textureQuality: downgradeSetting(currentSettings.textureQuality, ['low', 'medium', 'high', 'ultra']),
      shaderComplexity: downgradeSetting(currentSettings.shaderComplexity, ['basic', 'standard', 'advanced']),
      antiAliasing: downgradeSetting(currentSettings.antiAliasing, ['off', 'fxaa', 'msaa2x', 'msaa4x']),
      postProcessing: downgradeSetting(currentSettings.postProcessing, ['off', 'basic', 'full']),
    }
  } else if (fpsRatio > 1.2) {
    // Performance is excellent, can increase quality
    return {
      ...currentSettings,
      renderDistance: Math.min(32, currentSettings.renderDistance * 1.05),
      shadowQuality: upgradeSetting(currentSettings.shadowQuality, ['off', 'low', 'medium', 'high']),
      textureQuality: upgradeSetting(currentSettings.textureQuality, ['low', 'medium', 'high', 'ultra']),
      shaderComplexity: upgradeSetting(currentSettings.shaderComplexity, ['basic', 'standard', 'advanced']),
      antiAliasing: upgradeSetting(currentSettings.antiAliasing, ['off', 'fxaa', 'msaa2x', 'msaa4x']),
      postProcessing: upgradeSetting(currentSettings.postProcessing, ['off', 'basic', 'full']),
    }
  }

  return currentSettings
}

const downgradeSetting = <T>(current: T, levels: readonly T[]): T => {
  const currentIndex = levels.indexOf(current)
  return currentIndex > 0 ? levels[currentIndex - 1] : current
}

const upgradeSetting = <T>(current: T, levels: readonly T[]): T => {
  const currentIndex = levels.indexOf(current)
  return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : current
}

/**
 * Optimization Domain Service Port
 */
export interface IOptimizationDomainService {
  readonly calculateLOD: (entityId: EntityId, distance: number, config: LODConfiguration) => Effect.Effect<LODConfiguration, LODConfigurationError, never>

  readonly evaluateCulling: (
    entities: readonly EntityId[],
    spatialData: readonly SpatialOptimizationData[],
    viewerPosition: readonly [number, number, number],
    cullingConfigs: readonly CullingConfiguration[],
  ) => Effect.Effect<readonly CullingResult[], CullingError, never>

  readonly optimizeBatching: (
    entities: readonly EntityId[],
    spatialData: readonly SpatialOptimizationData[],
    strategy: BatchingStrategy,
  ) => Effect.Effect<readonly RenderBatch[], OptimizationError, never>

  readonly generateOptimizationDecisions: (
    currentMetrics: OptimizationMetrics,
    targets: OptimizationTargets,
    spatialData: readonly SpatialOptimizationData[],
  ) => Effect.Effect<readonly OptimizationDecision[], OptimizationError, never>

  readonly adjustQualityDynamically: (
    currentSettings: QualitySettings,
    currentMetrics: OptimizationMetrics,
    targets: OptimizationTargets,
  ) => Effect.Effect<QualitySettings, OptimizationError, never>

  readonly validateOptimizationTargets: (targets: OptimizationTargets) => Effect.Effect<boolean, OptimizationError, never>
}

/**
 * Pure domain functions implementation
 */

const calculateLODPure = (entityId: EntityId, distance: number, config: LODConfiguration): Effect.Effect<LODConfiguration, LODConfigurationError, never> =>
  Effect.gen(function* () {
    if (config.levels.length === 0) {
      throw new LODConfigurationError('LOD configuration must have at least one level')
    }

    if (!config.enabled) {
      return config
    }

    const newLevel = calculateLODLevel(distance, config.levels, config.currentLevel, config.hysteresis)

    if (newLevel === config.currentLevel) {
      return config
    }

    return {
      ...config,
      currentLevel: newLevel,
    }
  })

const evaluateCullingPure = (
  entities: readonly EntityId[],
  spatialData: readonly SpatialOptimizationData[],
  viewerPosition: readonly [number, number, number],
  cullingConfigs: readonly CullingConfiguration[],
): Effect.Effect<readonly CullingResult[], CullingError, never> =>
  Effect.gen(function* () {
    const results: CullingResult[] = []
    const entityMap = new Map(spatialData.map((data) => [data.entityId, data]))

    // Sort culling configs by priority (higher first)
    const sortedConfigs = [...cullingConfigs].filter((config) => config.enabled).sort((a, b) => b.priority - a.priority)

    for (const entityId of entities) {
      const entityData = entityMap.get(entityId)
      if (!entityData) {
        continue
      }

      let culled = false
      let cullingReason: CullingType | undefined

      // Apply culling strategies in priority order
      for (const config of sortedConfigs) {
        if (culled) break

        const result = evaluateCullingStrategy(config, entityData, viewerPosition)
        if (result.culled) {
          culled = true
          cullingReason = result.reason
          results.push(result)
          break
        }
      }

      // If not culled by any strategy, mark as visible
      if (!culled) {
        results.push({
          entityId,
          culled: false,
          reason: 'frustum', // Default reason for visible objects
        })
      }
    }

    return results
  })

const optimizeBatchingPure = (
  entities: readonly EntityId[],
  spatialData: readonly SpatialOptimizationData[],
  strategy: BatchingStrategy,
): Effect.Effect<readonly RenderBatch[], OptimizationError, never> =>
  Effect.gen(function* () {
    if (entities.length === 0) {
      return []
    }

    if (strategy.maxBatchSize <= 0) {
      throw new OptimizationError('Batch size must be positive')
    }

    return createOptimalBatches(entities, spatialData, strategy)
  })

const generateOptimizationDecisionsPure = (
  currentMetrics: OptimizationMetrics,
  targets: OptimizationTargets,
  spatialData: readonly SpatialOptimizationData[],
): Effect.Effect<readonly OptimizationDecision[], OptimizationError, never> =>
  Effect.gen(function* () {
    const decisions: OptimizationDecision[] = []

    // FPS optimization decisions
    if (currentMetrics.currentFPS < targets.targetFPS * 0.9) {
      decisions.push({
        strategy: 'aggressive-lod',
        entities: spatialData.map((d) => d.entityId),
        expectedImprovement: {
          fpsGain: 10,
          drawCallReduction: 0,
          memoryReduction: 0,
        },
        cost: {
          cpuOverhead: 5,
          memoryOverhead: 0,
          qualityLoss: 0.2,
        },
        priority: 0.8,
      })
    }

    // Draw call optimization decisions
    if (currentMetrics.drawCalls > targets.maxDrawCalls) {
      decisions.push({
        strategy: 'instanced-rendering',
        entities: spatialData.filter((d) => d.visibilityFrequency > 0.5).map((d) => d.entityId),
        expectedImprovement: {
          fpsGain: 5,
          drawCallReduction: Math.floor(currentMetrics.drawCalls * 0.5),
          memoryReduction: 0,
        },
        cost: {
          cpuOverhead: 10,
          memoryOverhead: 1024 * 1024, // 1MB
          qualityLoss: 0,
        },
        priority: 0.9,
      })
    }

    // Memory optimization decisions
    if (currentMetrics.memoryUsage > targets.maxMemoryUsage * 0.8) {
      decisions.push({
        strategy: 'texture-streaming',
        entities: spatialData.filter((d) => d.lastVisible < Date.now() - 10000).map((d) => d.entityId),
        expectedImprovement: {
          fpsGain: 2,
          drawCallReduction: 0,
          memoryReduction: Math.floor(currentMetrics.memoryUsage * 0.2),
        },
        cost: {
          cpuOverhead: 15,
          memoryOverhead: 0,
          qualityLoss: 0.1,
        },
        priority: 0.7,
      })
    }

    // Sort decisions by impact
    return decisions.sort((a, b) => {
      const impactA = calculateOptimizationImpact(a, currentMetrics, targets)
      const impactB = calculateOptimizationImpact(b, currentMetrics, targets)
      return impactB - impactA
    })
  })

const adjustQualityDynamicallyPure = (
  currentSettings: QualitySettings,
  currentMetrics: OptimizationMetrics,
  targets: OptimizationTargets,
): Effect.Effect<QualitySettings, OptimizationError, never> => Effect.succeed(adjustQualitySettings(currentSettings, currentMetrics, targets))

const validateOptimizationTargetsPure = (targets: OptimizationTargets): Effect.Effect<boolean, OptimizationError, never> =>
  Effect.gen(function* () {
    if (targets.targetFPS <= 0) {
      throw new OptimizationError('Target FPS must be positive')
    }

    if (targets.maxDrawCalls <= 0) {
      throw new OptimizationError('Max draw calls must be positive')
    }

    if (targets.maxTriangles <= 0) {
      throw new OptimizationError('Max triangles must be positive')
    }

    if (targets.maxMemoryUsage <= 0) {
      throw new OptimizationError('Max memory usage must be positive')
    }

    if (targets.lodBias < -1.0 || targets.lodBias > 1.0) {
      throw new OptimizationError('LOD bias must be between -1.0 and 1.0')
    }

    return true
  })

/**
 * Optimization Domain Service Implementation
 */
const optimizationDomainService: IOptimizationDomainService = {
  calculateLOD: calculateLODPure,
  evaluateCulling: evaluateCullingPure,
  optimizeBatching: optimizeBatchingPure,
  generateOptimizationDecisions: generateOptimizationDecisionsPure,
  adjustQualityDynamically: adjustQualityDynamicallyPure,
  validateOptimizationTargets: validateOptimizationTargetsPure,
}

/**
 * Context tag for dependency injection
 */
export const OptimizationDomainServicePort = Context.GenericTag<IOptimizationDomainService>('@domain/OptimizationDomainService')

/**
 * Live layer for Optimization Domain Service
 */
export const OptimizationDomainServiceLive = Layer.succeed(OptimizationDomainServicePort, optimizationDomainService)

/**
 * Utility functions for optimization domain operations
 */
export const OptimizationDomainUtils = {
  /**
   * Create default LOD configuration
   */
  createDefaultLODConfig: (entityId: EntityId): LODConfiguration => ({
    entityId,
    levels: OPTIMIZATION_CONSTANTS.LOD.DEFAULT_LEVELS,
    currentLevel: 0,
    hysteresis: OPTIMIZATION_CONSTANTS.LOD.HYSTERESIS_FACTOR,
    enabled: true,
  }),

  /**
   * Create default optimization targets
   */
  createDefaultOptimizationTargets: (): OptimizationTargets => ({
    targetFPS: OPTIMIZATION_CONSTANTS.PERFORMANCE.TARGET_FPS,
    maxDrawCalls: 1000,
    maxTriangles: 1000000,
    maxMemoryUsage: 512 * 1024 * 1024, // 512MB
    maxInstancesPerBatch: OPTIMIZATION_CONSTANTS.BATCHING.MAX_INSTANCES,
    lodBias: 0,
  }),

  /**
   * Create default quality settings
   */
  createDefaultQualitySettings: (): QualitySettings => ({
    renderDistance: 16,
    shadowQuality: 'medium',
    textureQuality: 'medium',
    shaderComplexity: 'standard',
    antiAliasing: 'fxaa',
    postProcessing: 'basic',
  }),

  /**
   * Create default batching strategy
   */
  createDefaultBatchingStrategy: (): BatchingStrategy => ({
    type: 'instanced',
    maxBatchSize: OPTIMIZATION_CONSTANTS.BATCHING.MAX_BATCH_SIZE,
    geometryCompatibility: 'similar',
    materialCompatibility: 'compatible',
    sortingCriteria: ['distance', 'material', 'geometry'],
  }),

  /**
   * Calculate screen space size
   */
  calculateScreenSpaceSize: (objectSize: number, distance: number, fov: number = 60, screenHeight: number = 1080): number => {
    const fovRadians = (fov * Math.PI) / 180
    const angularSize = Math.atan(objectSize / distance)
    return (angularSize / fovRadians) * screenHeight
  },

  /**
   * Estimate triangle count reduction
   */
  estimateTriangleReduction: (originalCount: number, lodLevel: number, maxLevels: number): number => {
    const reductionFactor = Math.pow(0.5, lodLevel)
    return Math.floor(originalCount * reductionFactor)
  },

  /**
   * Calculate batching efficiency
   */
  calculateBatchingEfficiency: (batch: RenderBatch): number => {
    if (batch.entities.length === 0) return 0

    const instanceEfficiency = batch.strategy.type === 'instanced' ? batch.entities.length / batch.estimatedDrawCalls : 1

    const triangleEfficiency = Math.min(1, batch.estimatedTriangles / 10000)

    return (instanceEfficiency + triangleEfficiency) / 2
  },
} as const

/**
 * Export types and constants
 */
export type {
  LODLevel,
  LODConfiguration,
  CullingConfiguration,
  CullingResult,
  BatchingStrategy,
  RenderBatch,
  OptimizationTargets,
  OptimizationMetrics,
  OptimizationDecision,
  SpatialOptimizationData,
  QualitySettings,
  CullingType,
  IOptimizationDomainService,
}
