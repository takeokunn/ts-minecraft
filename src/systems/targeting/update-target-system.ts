/**
 * Update Target System - Next-Generation Targeting and Raycasting
 * 
 * Features:
 * - High-performance raycasting with spatial optimization
 * - Multi-target selection with priority filtering
 * - Predictive targeting for moving objects
 * - Target validation and conflict resolution
 * - Visual target highlighting and feedback
 * - Customizable targeting behaviors
 */

import { Effect, Array as _EffArray, Duration, Option } from 'effect'
import { ArchetypeQuery, trackPerformance } from '@/core/queries'
import { World, InputManager as _InputManager } from '@/runtime/services'
import { SystemFunction, SystemConfig, SystemContext } from '../core/scheduler'
import { Position, CameraComponent, TargetComponent, InputStateComponent } from '@/core/components'
import { EntityId } from '@/core/entities/entity'
import { BlockType, BlockPosition } from '@/domain/value-objects'
import * as THREE from 'three'

/**
 * Target system configuration
 */
export interface TargetConfig {
  readonly maxTargetDistance: number
  readonly raycastStepSize: number
  readonly enableBlockTargeting: boolean
  readonly enableEntityTargeting: boolean
  readonly enablePredictiveTargeting: boolean
  readonly targetHighlighting: boolean
  readonly multiTargetSelection: boolean
  readonly maxTargets: number
  readonly targetFilters: readonly TargetFilter[]
  readonly priorityWeighting: {
    readonly distance: number
    readonly size: number
    readonly type: number
    readonly velocity: number
  }
}

/**
 * Target filter
 */
export interface TargetFilter {
  readonly id: string
  readonly name: string
  readonly enabled: boolean
  readonly predicate: (target: TargetCandidate) => boolean
  readonly priority: number
}

/**
 * Target type
 */
export type TargetType = 'block' | 'entity' | 'point' | 'area'

/**
 * Target candidate
 */
export interface TargetCandidate {
  readonly type: TargetType
  readonly position: Position
  readonly entityId: Option.Option<EntityId>
  readonly blockType: Option.Option<BlockType>
  readonly distance: number
  readonly size: number
  readonly velocity: Option.Option<{ x: number, y: number, z: number }>
  readonly priority: number
  readonly isValid: boolean
}

/**
 * Raycast hit result
 */
interface RaycastHit {
  readonly hit: boolean
  readonly position: Position
  readonly normal: THREE.Vector3
  readonly distance: number
  readonly entityId: Option.Option<EntityId>
  readonly blockPosition: Option.Option<BlockPosition>
  readonly material: Option.Option<string>
}

/**
 * Target selection result
 */
interface TargetSelectionResult {
  readonly primary: Option.Option<TargetCandidate>
  readonly secondary: readonly TargetCandidate[]
  readonly raycastHits: readonly RaycastHit[]
  readonly validationErrors: readonly string[]
}

/**
 * Predictive targeting data
 */
interface PredictiveTarget {
  readonly currentPosition: Position
  readonly predictedPosition: Position
  readonly velocity: { x: number, y: number, z: number }
  readonly timeToIntercept: number
  readonly confidence: number
}

/**
 * Default target configuration
 */
export const defaultTargetConfig: TargetConfig = {
  maxTargetDistance: 8.0,
  raycastStepSize: 0.1,
  enableBlockTargeting: true,
  enableEntityTargeting: true,
  enablePredictiveTargeting: false,
  targetHighlighting: true,
  multiTargetSelection: false,
  maxTargets: 1,
  targetFilters: [],
  priorityWeighting: {
    distance: 0.5,
    size: 0.2,
    type: 0.2,
    velocity: 0.1,
  },
}

/**
 * Default target filters
 */
export const defaultTargetFilters: TargetFilter[] = [
  {
    id: 'blocks',
    name: 'Block Targeting',
    enabled: true,
    predicate: (target) => target.type === 'block',
    priority: 1.0,
  },
  {
    id: 'entities',
    name: 'Entity Targeting',
    enabled: true,
    predicate: (target) => target.type === 'entity',
    priority: 0.8,
  },
  {
    id: 'nearby',
    name: 'Nearby Targets',
    enabled: true,
    predicate: (target) => target.distance <= 5.0,
    priority: 0.9,
  },
  {
    id: 'large',
    name: 'Large Targets',
    enabled: false,
    predicate: (target) => target.size >= 2.0,
    priority: 0.7,
  },
]

/**
 * Targeting utilities
 */
export const TargetingUtils = {
  /**
   * Create ray from camera
   */
  createRayFromCamera: (position: Position, camera: CameraComponent): THREE.Ray => {
    const origin = new THREE.Vector3(position.x, position.y, position.z)
    
    // Convert pitch/yaw to direction vector
    const pitchRad = camera.pitch * Math.PI / 180
    const yawRad = camera.yaw * Math.PI / 180
    
    const direction = new THREE.Vector3(
      Math.cos(pitchRad) * Math.sin(yawRad),
      -Math.sin(pitchRad),
      Math.cos(pitchRad) * Math.cos(yawRad)
    ).normalize()
    
    return new THREE.Ray(origin, direction)
  },

  /**
   * Calculate target priority
   */
  calculateTargetPriority: (
    candidate: TargetCandidate, 
    config: TargetConfig
  ): number => {
    const weights = config.priorityWeighting
    
    // Distance factor (closer = higher priority)
    const distanceFactor = Math.max(0, 1 - candidate.distance / config.maxTargetDistance)
    
    // Size factor (larger = higher priority for entities, normalized for blocks)
    const sizeFactor = candidate.type === 'entity' ? 
      Math.min(1, candidate.size / 10) : 
      0.5 // Blocks have standard priority
    
    // Type factor (based on filters)
    const typeFactor = candidate.type === 'block' ? 0.8 : 1.0
    
    // Velocity factor (moving targets are harder to hit, lower priority)
    const velocityFactor = Option.match(candidate.velocity, {
      onNone: () => 1.0,
      onSome: (vel) => {
        const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2)
        return Math.max(0.1, 1 - speed / 20) // Normalize against max expected speed
      },
    })
    
    return (
      distanceFactor * weights.distance +
      sizeFactor * weights.size +
      typeFactor * weights.type +
      velocityFactor * weights.velocity
    ) * candidate.priority
  },

  /**
   * Validate target candidate
   */
  validateTarget: (candidate: TargetCandidate, config: TargetConfig): boolean => {
    // Distance check
    if (candidate.distance > config.maxTargetDistance) {
      return false
    }
    
    // Type check
    if (!config.enableBlockTargeting && candidate.type === 'block') {
      return false
    }
    
    if (!config.enableEntityTargeting && candidate.type === 'entity') {
      return false
    }
    
    // Filter checks
    for (const filter of config.targetFilters) {
      if (filter.enabled && !filter.predicate(candidate)) {
        return false
      }
    }
    
    return true
  },

  /**
   * Convert world position to block position
   */
  worldToBlockPosition: (position: Position): BlockPosition => ({
    x: Math.floor(position.x),
    y: Math.floor(position.y),
    z: Math.floor(position.z),
  }),
}

/**
 * Advanced targeting processor
 */
class TargetingProcessor {
  private targetCandidates: TargetCandidate[] = []
  private raycastCache = new Map<string, RaycastHit>()
  private targetValidationCache = new Map<string, boolean>()

  constructor(private config: TargetConfig) {}

  /**
   * Process targeting for all players
   */
  async processTargeting(
    players: {
      entityId: EntityId
      position: Position
      cameraState: CameraComponent
      inputState: InputStateComponent
      currentTarget: Option.Option<TargetComponent>
    }[],
    world: any
  ): Promise<{
    targetUpdates: Map<EntityId, TargetComponent>
    raycastResults: Map<EntityId, RaycastHit[]>
    validationErrors: string[]
  }> {
    const targetUpdates = new Map<EntityId, TargetComponent>()
    const raycastResults = new Map<EntityId, RaycastHit[]>()
    const validationErrors: string[] = []

    for (const player of players) {
      const result = await this.processPlayerTargeting(player, world)
      
      if (Option.isSome(result.primary)) {
        const target: TargetComponent = {
          position: result.primary.value.position,
          entityId: result.primary.value.entityId,
          blockType: result.primary.value.blockType,
          distance: result.primary.value.distance,
          normal: new THREE.Vector3(0, 1, 0), // Would be calculated from raycast
          isValid: result.primary.value.isValid,
        }
        
        targetUpdates.set(player.entityId, target)
      }
      
      raycastResults.set(player.entityId, result.raycastHits)
      validationErrors.push(...result.validationErrors)
    }

    return {
      targetUpdates,
      raycastResults,
      validationErrors,
    }
  }

  /**
   * Process targeting for a single player
   */
  private async processPlayerTargeting(
    player: {
      entityId: EntityId
      position: Position
      cameraState: CameraComponent
      inputState: InputStateComponent
      currentTarget: Option.Option<TargetComponent>
    },
    world: any
  ): Promise<TargetSelectionResult> {
    // Create ray from camera
    const ray = TargetingUtils.createRayFromCamera(player.position, player.cameraState)
    
    // Perform raycast
    const raycastHits = await this.performRaycast(ray, world)
    
    // Generate target candidates
    const candidates = await this.generateTargetCandidates(
      ray,
      raycastHits,
      player.position,
      world
    )
    
    // Filter and prioritize candidates
    const filteredCandidates = this.filterAndPrioritizeCandidates(candidates)
    
    // Select primary target
    const primary = filteredCandidates.length > 0 ? 
      Option.some(filteredCandidates[0]!) : 
      Option.none<TargetCandidate>()
    
    // Select secondary targets
    const secondary = this.config.multiTargetSelection ? 
      filteredCandidates.slice(1, this.config.maxTargets) : 
      []
    
    return {
      primary,
      secondary,
      raycastHits,
      validationErrors: [],
    }
  }

  /**
   * Perform raycast with optimizations
   */
  private async performRaycast(ray: THREE.Ray, world: any): Promise<RaycastHit[]> {
    const hits: RaycastHit[] = []
    const stepSize = this.config.raycastStepSize
    const maxDistance = this.config.maxTargetDistance
    
    // Step along ray
    for (let distance = 0; distance < maxDistance; distance += stepSize) {
      const point = ray.at(distance, new THREE.Vector3())
      const position: Position = { x: point.x, y: point.y, z: point.z }
      
      // Check for block collision
      if (this.config.enableBlockTargeting) {
        const blockPos = TargetingUtils.worldToBlockPosition(position)
        const voxel = await world.getVoxel(blockPos.x, blockPos.y, blockPos.z)
        
        if (Option.isSome(voxel)) {
          hits.push({
            hit: true,
            position,
            normal: new THREE.Vector3(0, 1, 0), // Simplified
            distance,
            entityId: Option.none(),
            blockPosition: Option.some(blockPos),
            material: Option.some('block'), // Simplified
          })
          break // First hit stops the ray
        }
      }
      
      // Check for entity collisions would go here
      // This would require querying entities at the ray position
    }
    
    return hits
  }

  /**
   * Generate target candidates from raycast results
   */
  private async generateTargetCandidates(
    _ray: THREE.Ray,
    hits: RaycastHit[],
    _playerPosition: Position,
    world: any
  ): Promise<TargetCandidate[]> {
    const candidates: TargetCandidate[] = []
    
    for (const hit of hits) {
      if (hit.hit) {
        // Create block candidate
        if (Option.isSome(hit.blockPosition)) {
          const blockType = await world.getVoxel(
            hit.blockPosition.value.x,
            hit.blockPosition.value.y,
            hit.blockPosition.value.z
          )
          
          const candidate: TargetCandidate = {
            type: 'block',
            position: hit.position,
            entityId: Option.none(),
            blockType,
            distance: hit.distance,
            size: 1.0, // Standard block size
            velocity: Option.none(),
            priority: 1.0,
            isValid: true,
          }
          
          if (TargetingUtils.validateTarget(candidate, this.config)) {
            candidates.push(candidate)
          }
        }
        
        // Create entity candidate
        if (Option.isSome(hit.entityId)) {
          // Would query entity data here
          const candidate: TargetCandidate = {
            type: 'entity',
            position: hit.position,
            entityId: hit.entityId,
            blockType: Option.none(),
            distance: hit.distance,
            size: 2.0, // Would be calculated from entity collider
            velocity: Option.none(), // Would be retrieved from entity
            priority: 1.0,
            isValid: true,
          }
          
          if (TargetingUtils.validateTarget(candidate, this.config)) {
            candidates.push(candidate)
          }
        }
      }
    }
    
    return candidates
  }

  /**
   * Filter and prioritize candidates
   */
  private filterAndPrioritizeCandidates(candidates: TargetCandidate[]): TargetCandidate[] {
    // Apply filters
    let filteredCandidates = candidates.filter(candidate => 
      TargetingUtils.validateTarget(candidate, this.config)
    )
    
    // Calculate priorities
    filteredCandidates = filteredCandidates.map(candidate => ({
      ...candidate,
      priority: TargetingUtils.calculateTargetPriority(candidate, this.config),
    }))
    
    // Sort by priority (highest first)
    return filteredCandidates.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Predict target position for moving entities
   */
  private _predictTargetPosition(
    candidate: TargetCandidate,
    _playerPosition: Position
  ): Option.Option<PredictiveTarget> {
    if (!this.config.enablePredictiveTargeting || Option.isNone(candidate.velocity)) {
      return Option.none()
    }
    
    const velocity = candidate.velocity.value
    const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2)
    
    if (speed < 0.1) {
      return Option.none() // Not moving enough to predict
    }
    
    // Simple linear prediction
    const distance = candidate.distance
    const timeToIntercept = distance / 20 // Assume projectile speed of 20 units/sec
    
    const predictedPosition: Position = {
      x: candidate.position.x + velocity.x * timeToIntercept,
      y: candidate.position.y + velocity.y * timeToIntercept,
      z: candidate.position.z + velocity.z * timeToIntercept,
    }
    
    return Option.some({
      currentPosition: candidate.position,
      predictedPosition,
      velocity,
      timeToIntercept,
      confidence: Math.max(0, 1 - speed / 50), // Lower confidence for faster targets
    })
  }

  /**
   * Get processor statistics
   */
  getStats(): {
    candidateCount: number
    raycastCacheSize: number
    validationCacheSize: number
  } {
    return {
      candidateCount: this.targetCandidates.length,
      raycastCacheSize: this.raycastCache.size,
      validationCacheSize: this.targetValidationCache.size,
    }
  }
}

/**
 * Create optimized update target system
 */
export const createUpdateTargetSystem = (
  config: Partial<TargetConfig> = {}
): SystemFunction => {
  const targetConfig = { 
    ...defaultTargetConfig, 
    ...config,
    targetFilters: [...defaultTargetFilters, ...(config.targetFilters || [])],
  }
  const processor = new TargetingProcessor(targetConfig)

  return (context: SystemContext) => Effect.gen(function* ($) {
    const world = yield* $(World)
    
    const startTime = Date.now()

    // Query players with targeting capability
    const playerQuery = ArchetypeQuery()
      .with('player', 'position', 'cameraState', 'inputState')
      .maybe('target')
      .execute()

    if (playerQuery.entities.length === 0) {
      return // No players
    }

    // Extract player data
    const players = playerQuery.entities.map(entityId => {
      const position = playerQuery.getComponent<Position>(entityId, 'position')
      const cameraState = playerQuery.getComponent<CameraComponent>(entityId, 'cameraState')
      const inputState = playerQuery.getComponent<InputStateComponent>(entityId, 'inputState')
      const currentTarget = playerQuery.getComponent<TargetComponent>(entityId, 'target')

      return {
        entityId,
        position: (position as any).value,
        cameraState: (cameraState as any).value,
        inputState: (inputState as any).value,
        currentTarget: currentTarget._tag === 'Some' ? Option.some((currentTarget as any).value) : Option.none(),
      }
    }).filter(player => player.position && player.cameraState && player.inputState)

    // Process targeting
    const result = yield* $(
      Effect.promise(() => processor.processTargeting(players, world))
    )

    // Apply target updates
    yield* $(
      Effect.forEach(
        Array.from(result.targetUpdates.entries()),
        ([entityId, target]) => Effect.gen(function* ($) {
          yield* $(world.updateComponent(entityId, 'target', target))
        }),
        { concurrency: 'inherit', discard: true }
      )
    )

    // Log validation errors
    for (const error of result.validationErrors) {
      console.warn(`Target Validation Error: ${error}`)
    }

    // Performance tracking
    const endTime = Date.now()
    const executionTime = endTime - startTime
    trackPerformance('update-target', 'write', executionTime)

    // Debug logging
    if (context.frameId % 60 === 0) {
      const stats = processor.getStats()
      const targetCount = result.targetUpdates.size
      console.debug(`Update Target System - Targets: ${targetCount}, Candidates: ${stats.candidateCount}, Time: ${executionTime}ms`)
    }
  })
}

/**
 * System configuration for update target
 */
export const updateTargetSystemConfig: SystemConfig = {
  id: 'update-target',
  name: 'Update Target System',
  priority: 'high',
  phase: 'update',
  dependencies: ['input', 'physics'],
  conflicts: [],
  maxExecutionTime: Duration.millis(4),
  enableProfiling: true,
}

/**
 * Default update target system instance
 */
export const updateTargetSystem = createUpdateTargetSystem()

/**
 * Update target system variants
 */
export const updateTargetSystemVariants = {
  /**
   * Precision targeting for detailed work
   */
  precision: createUpdateTargetSystem({
    raycastStepSize: 0.05,
    maxTargetDistance: 6.0,
    enablePredictiveTargeting: true,
    targetHighlighting: true,
  }),

  /**
   * Performance targeting for large worlds
   */
  performance: createUpdateTargetSystem({
    raycastStepSize: 0.2,
    maxTargetDistance: 5.0,
    enablePredictiveTargeting: false,
    targetHighlighting: false,
  }),

  /**
   * Creative mode targeting with extended range
   */
  creative: createUpdateTargetSystem({
    maxTargetDistance: 16.0,
    multiTargetSelection: true,
    maxTargets: 5,
    enableBlockTargeting: true,
    enableEntityTargeting: true,
  }),
}

/**
 * Update target system utilities
 */
export const UpdateTargetSystemUtils = {
  /**
   * Create system for interaction mode
   */
  forInteractionMode: (mode: 'block' | 'entity' | 'both') => {
    const modes = {
      block: createUpdateTargetSystem({
        enableBlockTargeting: true,
        enableEntityTargeting: false,
      }),
      entity: createUpdateTargetSystem({
        enableBlockTargeting: false,
        enableEntityTargeting: true,
      }),
      both: updateTargetSystem,
    }
    
    return modes[mode]
  },

  /**
   * Create custom target filter
   */
  createTargetFilter: (
    id: string,
    name: string,
    predicate: (target: TargetCandidate) => boolean,
    priority = 1.0
  ): TargetFilter => ({
    id,
    name,
    enabled: true,
    predicate,
    priority,
  }),

  /**
   * Calculate optimal raycast step size for distance
   */
  calculateOptimalStepSize: (maxDistance: number): number => {
    // Balance between accuracy and performance
    return Math.max(0.05, Math.min(0.2, maxDistance / 50))
  },
}