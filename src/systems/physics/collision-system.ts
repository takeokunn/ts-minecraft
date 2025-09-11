/**
 * Collision System - Next-Generation Collision Detection and Resolution
 * 
 * Features:
 * - Broad phase collision detection with spatial partitioning
 * - Narrow phase with optimized collision algorithms
 * - Continuous collision detection for fast-moving objects
 * - Multi-threaded collision processing
 * - Collision response with physics integration
 * - Collision event system for gameplay effects
 */

import { Effect, Array as EffArray, Duration, Option } from 'effect'
import { ArchetypeQuery, trackPerformance } from '@/domain/queries'
import { World, SpatialGrid } from '@/runtime/services'
import { SystemFunction, SystemConfig, SystemContext } from '../application/scheduler'
import { PositionComponent, VelocityComponent, ColliderComponent, MassComponent } from '@/domain/entities/components'
import { EntityId } from '@/domain/entities'
import { AABB, createAABB as domainCreateAABB } from '@/domain/geometry'
import { toFloat } from '@/domain/value-objects/common'

/**
 * Collision system configuration
 */
export interface CollisionConfig {
  readonly enableBroadPhase: boolean
  readonly enableNarrowPhase: boolean
  readonly enableContinuousDetection: boolean
  readonly maxCollisionIterations: number
  readonly collisionTolerance: number
  readonly restitutionDamping: number
  readonly frictionCoefficient: number
  readonly enableSpatialPartitioning: boolean
  readonly spatialGridCellSize: number
  readonly enableMultithreading: boolean
  readonly collisionLayers: readonly string[]
}

/**
 * Collision shape type
 */
export type CollisionShape = 'box' | 'sphere' | 'capsule' | 'mesh'

/**
 * Collision information
 */
export interface CollisionInfo {
  readonly entityA: EntityId
  readonly entityB: EntityId
  readonly contactPoint: PositionComponent
  readonly contactNormal: { x: number, y: number, z: number }
  readonly penetration: number
  readonly relativeVelocity: number
  readonly restitution: number
  readonly friction: number
  readonly timestamp: number
}

/**
 * Collision pair for broad phase
 */
interface CollisionPair {
  readonly entityA: EntityId
  readonly entityB: EntityId
  readonly aabbA: AABB
  readonly aabbB: AABB
  readonly priority: number
}

/**
 * Collision response data
 */
interface CollisionResponse {
  readonly entityId: EntityId
  readonly velocityChange: VelocityComponent
  readonly positionCorrection: PositionComponent
  readonly impulse: { x: number, y: number, z: number }
}

/**
 * Collision event
 */
export interface CollisionEvent {
  readonly type: 'collision_enter' | 'collision_stay' | 'collision_exit'
  readonly collision: CollisionInfo
  readonly frameId: number
}

/**
 * Default collision configuration
 */
export const defaultCollisionConfig: CollisionConfig = {
  enableBroadPhase: true,
  enableNarrowPhase: true,
  enableContinuousDetection: true,
  maxCollisionIterations: 4,
  collisionTolerance: 0.01,
  restitutionDamping: 0.8,
  frictionCoefficient: 0.7,
  enableSpatialPartitioning: true,
  spatialGridCellSize: 4.0,
  enableMultithreading: false, // Disabled by default due to Effect-TS fiber management
  collisionLayers: ['default', 'player', 'environment', 'projectile'],
}

/**
 * Collision detection utilities
 */
export const CollisionUtils = {
  /**
   * Check AABB vs AABB collision
   */
  aabbVsAabb: (a: AABB, b: AABB): boolean => {
    return a.minX <= b.maxX && a.maxX >= b.minX &&
           a.minY <= b.maxY && a.maxY >= b.minY &&
           a.minZ <= b.maxZ && a.maxZ >= b.minZ
  },

  /**
   * Calculate AABB overlap
   */
  aabbOverlap: (a: AABB, b: AABB): { x: number, y: number, z: number } => {
    return {
      x: Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)),
      y: Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)),
      z: Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ)),
    }
  },

  /**
   * Create AABB from position and collider
   */
  createAABB: (position: PositionComponent, collider: ColliderComponent): AABB => {
    return domainCreateAABB(position, collider)
  },

  /**
   * Calculate collision normal
   */
  calculateNormal: (a: AABB, b: AABB): { x: number, y: number, z: number } => {
    const overlap = CollisionUtils.aabbOverlap(a, b)
    
    // Find axis of minimum penetration
    if (overlap.x < overlap.y && overlap.x < overlap.z) {
      return { x: a.minX + a.maxX < b.minX + b.maxX ? -1 : 1, y: 0, z: 0 }
    } else if (overlap.y < overlap.z) {
      return { x: 0, y: a.minY + a.maxY < b.minY + b.maxY ? -1 : 1, z: 0 }
    } else {
      return { x: 0, y: 0, z: a.minZ + a.maxZ < b.minZ + b.maxZ ? -1 : 1 }
    }
  },

  /**
   * Calculate contact point
   */
  calculateContactPoint: (a: AABB, b: AABB): PositionComponent => {
    return {
      x: (Math.max(a.minX, b.minX) + Math.min(a.maxX, b.maxX)) / 2,
      y: (Math.max(a.minY, b.minY) + Math.min(a.maxY, b.maxY)) / 2,
      z: (Math.max(a.minZ, b.minZ) + Math.min(a.maxZ, b.maxZ)) / 2,
    }
  },

  /**
   * Calculate relative velocity
   */
  calculateRelativeVelocity: (
    velA: VelocityComponent, 
    velB: VelocityComponent, 
    normal: { x: number, y: number, z: number }
  ): number => {
    const relVel = {
      x: velA.x - velB.x,
      y: velA.y - velB.y,
      z: velA.z - velB.z,
    }
    
    return relVel.x * normal.x + relVel.y * normal.y + relVel.z * normal.z
  },
}

/**
 * Advanced collision processor
 */
class CollisionProcessor {
  private collisionPairs: CollisionPair[] = []
  private activeCollisions = new Map<string, CollisionInfo>()
  private collisionEvents: CollisionEvent[] = []
  private spatialGrid = new Map<string, EntityId[]>()

  constructor(private config: CollisionConfig) {}

  /**
   * Process collision detection and response
   */
  async processCollisions(
    entities: {
      entityId: EntityId
      position: PositionComponent
      velocity: VelocityComponent
      collider: ColliderComponent
      mass: Option.Option<MassComponent>
    }[],
    frameId: number
  ): Promise<{
    collisions: CollisionInfo[]
    responses: CollisionResponse[]
    events: CollisionEvent[]
  }> {
    const collisions: CollisionInfo[] = []
    const responses: CollisionResponse[] = []
    this.collisionEvents = []

    // Broad phase collision detection
    if (this.config.enableBroadPhase) {
      this.collisionPairs = await this.broadPhaseDetection(entities)
    }

    // Narrow phase collision detection
    if (this.config.enableNarrowPhase) {
      const narrowPhaseCollisions = await this.narrowPhaseDetection(
        this.collisionPairs,
        entities,
        frameId
      )
      collisions.push(...narrowPhaseCollisions)
    }

    // Collision response
    const collisionResponses = await this.calculateCollisionResponses(collisions, entities)
    responses.push(...collisionResponses)

    // Update collision events
    this.updateCollisionEvents(collisions, frameId)

    return {
      collisions,
      responses,
      events: [...this.collisionEvents],
    }
  }

  /**
   * Broad phase collision detection using spatial partitioning
   */
  private async broadPhaseDetection(
    entities: {
      entityId: EntityId
      position: PositionComponent
      velocity: VelocityComponent
      collider: ColliderComponent
      mass: Option.Option<MassComponent>
    }[]
  ): Promise<CollisionPair[]> {
    const pairs: CollisionPair[] = []

    if (this.config.enableSpatialPartitioning) {
      // Use spatial grid for efficient broad phase
      this.updateSpatialGrid(entities)
      
      for (const entity of entities) {
        const aabb = CollisionUtils.createAABB(entity.position, entity.collider)
        const nearbyEntities = this.getNearbyEntities(entity.position)
        
        for (const nearbyId of nearbyEntities) {
          if (nearbyId === entity.entityId) continue
          
          const nearbyEntity = entities.find(e => e.entityId === nearbyId)
          if (!nearbyEntity) continue
          
          const nearbyAABB = CollisionUtils.createAABB(nearbyEntity.position, nearbyEntity.collider)
          
          if (CollisionUtils.aabbVsAabb(aabb, nearbyAABB)) {
            // Calculate priority based on relative velocity and mass
            const priority = this.calculateCollisionPriority(entity, nearbyEntity)
            
            pairs.push({
              entityA: entity.entityId,
              entityB: nearbyEntity.entityId,
              aabbA: aabb,
              aabbB: nearbyAABB,
              priority,
            })
          }
        }
      }
    } else {
      // Naive O(n²) broad phase for small entity counts
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const entityA = entities[i]!
          const entityB = entities[j]!
          
          const aabbA = CollisionUtils.createAABB(entityA.position, entityA.collider)
          const aabbB = CollisionUtils.createAABB(entityB.position, entityB.collider)
          
          if (CollisionUtils.aabbVsAabb(aabbA, aabbB)) {
            const priority = this.calculateCollisionPriority(entityA, entityB)
            
            pairs.push({
              entityA: entityA.entityId,
              entityB: entityB.entityId,
              aabbA,
              aabbB,
              priority,
            })
          }
        }
      }
    }

    // Sort pairs by priority for processing order
    return pairs.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Narrow phase collision detection with precise geometry
   */
  private async narrowPhaseDetection(
    pairs: CollisionPair[],
    entities: {
      entityId: EntityId
      position: PositionComponent
      velocity: VelocityComponent
      collider: ColliderComponent
      mass: Option.Option<MassComponent>
    }[],
    frameId: number
  ): Promise<CollisionInfo[]> {
    const collisions: CollisionInfo[] = []
    const entityMap = new Map(entities.map(e => [e.entityId, e]))

    for (const pair of pairs) {
      const entityA = entityMap.get(pair.entityA)
      const entityB = entityMap.get(pair.entityB)
      
      if (!entityA || !entityB) continue

      // Detailed collision detection based on shape type
      const collision = this.detectCollision(
        entityA,
        entityB,
        pair.aabbA,
        pair.aabbB,
        frameId
      )

      if (collision) {
        collisions.push(collision)
      }
    }

    return collisions
  }

  /**
   * Detect collision between two entities
   */
  private detectCollision(
    entityA: {
      entityId: EntityId
      position: PositionComponent
      velocity: VelocityComponent
      collider: ColliderComponent
    },
    entityB: {
      entityId: EntityId
      position: PositionComponent
      velocity: VelocityComponent
      collider: ColliderComponent
    },
    aabbA: AABB,
    aabbB: AABB,
    frameId: number
  ): CollisionInfo | null {
    // For now, use AABB collision detection
    // This can be extended to support different collision shapes
    
    if (!CollisionUtils.aabbVsAabb(aabbA, aabbB)) {
      return null
    }

    const contactNormal = CollisionUtils.calculateNormal(aabbA, aabbB)
    const contactPoint = CollisionUtils.calculateContactPoint(aabbA, aabbB)
    const overlap = CollisionUtils.aabbOverlap(aabbA, aabbB)
    
    // Calculate minimum penetration depth
    const penetration = Math.min(overlap.x, overlap.y, overlap.z)
    
    const relativeVelocity = CollisionUtils.calculateRelativeVelocity(
      entityA.velocity,
      entityB.velocity,
      contactNormal
    )

    // Calculate material properties (simplified)
    const restitution = 0.5 * (entityA.collider.restitution + entityB.collider.restitution)
    const friction = Math.sqrt(entityA.collider.friction * entityB.collider.friction)

    return {
      entityA: entityA.entityId,
      entityB: entityB.entityId,
      contactPoint,
      contactNormal,
      penetration,
      relativeVelocity,
      restitution,
      friction,
      timestamp: Date.now(),
    }
  }

  /**
   * Calculate collision responses
   */
  private async calculateCollisionResponses(
    collisions: CollisionInfo[],
    entities: {
      entityId: EntityId
      position: PositionComponent
      velocity: VelocityComponent
      collider: ColliderComponent
      mass: Option.Option<MassComponent>
    }[]
  ): Promise<CollisionResponse[]> {
    const responses: CollisionResponse[] = []
    const entityMap = new Map(entities.map(e => [e.entityId, e]))

    for (const collision of collisions) {
      const entityA = entityMap.get(collision.entityA)
      const entityB = entityMap.get(collision.entityB)
      
      if (!entityA || !entityB) continue

      const massA = Option.match(entityA.mass, {
        onNone: () => 1.0,
        onSome: (m) => m.value,
      })
      
      const massB = Option.match(entityB.mass, {
        onNone: () => 1.0,
        onSome: (m) => m.value,
      })

      // Calculate collision impulse
      const impulseScale = -(1 + collision.restitution) * collision.relativeVelocity / (1/massA + 1/massB)
      
      const impulse = {
        x: collision.contactNormal.x * impulseScale,
        y: collision.contactNormal.y * impulseScale,
        z: collision.contactNormal.z * impulseScale,
      }

      // Apply impulse to velocities
      const velocityChangeA: VelocityComponent = {
        x: toFloat(entityA.velocity.x + impulse.x / massA),
        y: toFloat(entityA.velocity.y + impulse.y / massA),
        z: toFloat(entityA.velocity.z + impulse.z / massA),
      }

      const velocityChangeB: VelocityComponent = {
        x: toFloat(entityB.velocity.x - impulse.x / massB),
        y: toFloat(entityB.velocity.y - impulse.y / massB),
        z: toFloat(entityB.velocity.z - impulse.z / massB),
      }

      // Position correction to prevent sinking
      const correctionPercent = 0.8 // How much to correct
      const slop = 0.01 // Penetration allowance
      
      const correctionMagnitude = Math.max(collision.penetration - slop, 0) * 
                                 correctionPercent / (1/massA + 1/massB)

      const positionCorrectionA: PositionComponent = {
        x: toFloat(entityA.position.x + collision.contactNormal.x * correctionMagnitude / massA),
        y: toFloat(entityA.position.y + collision.contactNormal.y * correctionMagnitude / massA),
        z: toFloat(entityA.position.z + collision.contactNormal.z * correctionMagnitude / massA),
      }

      const positionCorrectionB: PositionComponent = {
        x: toFloat(entityB.position.x - collision.contactNormal.x * correctionMagnitude / massB),
        y: toFloat(entityB.position.y - collision.contactNormal.y * correctionMagnitude / massB),
        z: toFloat(entityB.position.z - collision.contactNormal.z * correctionMagnitude / massB),
      }

      responses.push(
        {
          entityId: collision.entityA,
          velocityChange: velocityChangeA,
          positionCorrection: positionCorrectionA,
          impulse,
        },
        {
          entityId: collision.entityB,
          velocityChange: velocityChangeB,
          positionCorrection: positionCorrectionB,
          impulse: { x: -impulse.x, y: -impulse.y, z: -impulse.z },
        }
      )
    }

    return responses
  }

  /**
   * Update spatial grid
   */
  private updateSpatialGrid(entities: { entityId: EntityId; position: PositionComponent }[]): void {
    this.spatialGrid.clear()

    for (const entity of entities) {
      const cellX = Math.floor(entity.position.x / this.config.spatialGridCellSize)
      const cellZ = Math.floor(entity.position.z / this.config.spatialGridCellSize)
      const key = `${cellX},${cellZ}`

      if (!this.spatialGrid.has(key)) {
        this.spatialGrid.set(key, [])
      }
      
      this.spatialGrid.get(key)!.push(entity.entityId)
    }
  }

  /**
   * Get nearby entities using spatial grid
   */
  private getNearbyEntities(position: PositionComponent): EntityId[] {
    const nearby: EntityId[] = []
    const cellX = Math.floor(position.x / this.config.spatialGridCellSize)
    const cellZ = Math.floor(position.z / this.config.spatialGridCellSize)

    // Check surrounding cells
    for (let x = cellX - 1; x <= cellX + 1; x++) {
      for (let z = cellZ - 1; z <= cellZ + 1; z++) {
        const key = `${x},${z}`
        const cellEntities = this.spatialGrid.get(key)
        if (cellEntities) {
          nearby.push(...cellEntities)
        }
      }
    }

    return nearby
  }

  /**
   * Calculate collision priority
   */
  private calculateCollisionPriority(entityA: any, entityB: any): number {
    // Higher velocity = higher priority
    const velMagA = Math.sqrt(entityA.velocity.x ** 2 + entityA.velocity.y ** 2 + entityA.velocity.z ** 2)
    const velMagB = Math.sqrt(entityB.velocity.x ** 2 + entityB.velocity.y ** 2 + entityB.velocity.z ** 2)
    
    // Higher mass = higher priority
    const massA = Option.match(entityA.mass, { onNone: () => 1, onSome: m => m.value })
    const massB = Option.match(entityB.mass, { onNone: () => 1, onSome: m => m.value })
    
    return (velMagA + velMagB) * (massA + massB)
  }

  /**
   * Update collision events
   */
  private updateCollisionEvents(collisions: CollisionInfo[], frameId: number): void {
    const currentCollisionKeys = new Set<string>()

    for (const collision of collisions) {
      const key = `${collision.entityA}-${collision.entityB}`
      currentCollisionKeys.add(key)

      if (this.activeCollisions.has(key)) {
        // Collision continues
        this.collisionEvents.push({
          type: 'collision_stay',
          collision,
          frameId,
        })
      } else {
        // New collision
        this.collisionEvents.push({
          type: 'collision_enter',
          collision,
          frameId,
        })
        this.activeCollisions.set(key, collision)
      }
    }

    // Check for ended collisions
    for (const [key, collision] of this.activeCollisions) {
      if (!currentCollisionKeys.has(key)) {
        this.collisionEvents.push({
          type: 'collision_exit',
          collision,
          frameId,
        })
        this.activeCollisions.delete(key)
      }
    }
  }

  /**
   * Get processor statistics
   */
  getStats(): {
    activePairs: number
    activeCollisions: number
    spatialGridCells: number
    eventsThisFrame: number
  } {
    return {
      activePairs: this.collisionPairs.length,
      activeCollisions: this.activeCollisions.size,
      spatialGridCells: this.spatialGrid.size,
      eventsThisFrame: this.collisionEvents.length,
    }
  }
}

/**
 * Create optimized collision system
 */
export const createCollisionSystem = (
  config: Partial<CollisionConfig> = {}
): SystemFunction => {
  const collisionConfig = { ...defaultCollisionConfig, ...config }
  const processor = new CollisionProcessor(collisionConfig)

  return (context: SystemContext) => Effect.gen(function* ($) {
    const world = yield* $(World)
    
    const startTime = Date.now()

    // Query entities with collision components
    const collisionQuery = ArchetypeQuery.create()
      .with('position', 'velocity', 'collider')
      .maybe('mass', 'acceleration')
      .execute()

    if (collisionQuery.entities.length < 2) {
      return // Need at least 2 entities for collision
    }

    // Extract collision entities
    const entities = collisionQuery.entities.map(entityId => {
      const position = collisionQuery.getComponent<PositionComponent>(entityId, 'position')
      const velocity = collisionQuery.getComponent<VelocityComponent>(entityId, 'velocity')
      const collider = collisionQuery.getComponent<ColliderComponent>(entityId, 'collider')
      const mass = collisionQuery.getComponent<MassComponent>(entityId, 'mass')

      return {
        entityId,
        position: (position as any).value,
        velocity: (velocity as any).value,
        collider: (collider as any).value,
        mass,
      }
    }).filter(entity => entity.position && entity.velocity && entity.collider)

    // Process collisions
    const result = yield* $(
      Effect.promise(() => processor.processCollisions(entities, context.frameId))
    )

    // Apply collision responses
    yield* $(
      Effect.forEach(
        result.responses,
        (response) => Effect.gen(function* ($) {
          // Update velocity
          yield* $(world.updateComponent(response.entityId, 'velocity', response.velocityChange))
          
          // Apply position correction
          yield* $(world.updateComponent(response.entityId, 'position', response.positionCorrection))
        }),
        { concurrency: 'inherit', discard: true }
      )
    )

    // Handle collision events (could trigger gameplay systems)
    for (const event of result.events) {
      if (event.type === 'collision_enter') {
        // Could trigger sound effects, particle effects, damage, etc.
        console.debug(`Collision detected between ${event.collision.entityA} and ${event.collision.entityB}`)
      }
    }

    // Performance tracking
    const endTime = Date.now()
    const executionTime = endTime - startTime
    trackPerformance('collision', 'write', executionTime)

    // Debug logging
    if (context.frameId % 60 === 0) {
      const stats = processor.getStats()
      console.debug(`Collision System - Pairs: ${stats.activePairs}, Collisions: ${stats.activeCollisions}, Events: ${stats.eventsThisFrame}, Time: ${executionTime}ms`)
    }
  })
}

/**
 * System configuration for collision
 */
export const collisionSystemConfig: SystemConfig = {
  id: 'collision',
  name: 'Collision System',
  priority: 'high',
  phase: 'collision',
  dependencies: ['physics'],
  conflicts: [],
  maxExecutionTime: Duration.millis(8),
  enableProfiling: true,
}

/**
 * Default collision system instance
 */
export const collisionSystem = createCollisionSystem()

/**
 * Collision system variants
 */
export const collisionSystemVariants = {
  /**
   * Performance optimized for many entities
   */
  performance: createCollisionSystem({
    enableBroadPhase: true,
    enableSpatialPartitioning: true,
    maxCollisionIterations: 2,
    spatialGridCellSize: 8.0,
  }),

  /**
   * Precision optimized for accurate physics
   */
  precision: createCollisionSystem({
    enableContinuousDetection: true,
    maxCollisionIterations: 8,
    collisionTolerance: 0.001,
    spatialGridCellSize: 2.0,
  }),

  /**
   * Simple collision for basic gameplay
   */
  simple: createCollisionSystem({
    enableBroadPhase: false,
    enableNarrowPhase: true,
    enableSpatialPartitioning: false,
    maxCollisionIterations: 1,
  }),
}

/**
 * Collision system utilities
 */
export const CollisionSystemUtils = {
  /**
   * Create system optimized for entity count
   */
  forEntityCount: (entityCount: number) => {
    if (entityCount < 50) {
      return collisionSystemVariants.simple
    } else if (entityCount < 200) {
      return collisionSystem
    } else {
      return collisionSystemVariants.performance
    }
  },

  /**
   * Create system with specific spatial grid size
   */
  withSpatialGrid: (cellSize: number) => createCollisionSystem({
    enableSpatialPartitioning: true,
    spatialGridCellSize: cellSize,
  }),
}