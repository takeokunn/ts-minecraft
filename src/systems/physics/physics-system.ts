/**
 * Physics System - Next-Generation Physics Processing
 * 
 * Features:
 * - Optimized SoA queries for bulk physics calculations
 * - Vector-based physics calculations with SIMD optimization potential
 * - Spatial partitioning integration
 * - Configurable physics parameters
 * - Performance monitoring and adaptive processing
 */

import { Effect, Array as EffArray, Duration } from 'effect'
import { ArchetypeQuery, trackPerformance } from '@/core/queries'
import { World, SpatialGrid } from '@/runtime/services'
import { SystemFunction, SystemConfig, SystemContext } from '../core/scheduler'
import { PositionComponent, VelocityComponent, AccelerationComponent, MassComponent, ColliderComponent } from '@/core/components'
import { FRICTION, GRAVITY, TERMINAL_VELOCITY, AIR_RESISTANCE } from '@/domain/world-constants'
import { toFloat } from '@/core/common'
import { createAABB } from '@/domain/geometry'


/**
 * Physics system configuration
 */
export interface PhysicsConfig {
  readonly enableGravity: boolean
  readonly enableFriction: boolean
  readonly enableAirResistance: boolean
  readonly gravityScale: number
  readonly frictionScale: number
  readonly maxVelocity: number
  readonly timeStep: number
  readonly spatialPartitioning: boolean
}

/**
 * Physics calculation result
 */
interface PhysicsResult {
  readonly newPosition: PositionComponent
  readonly newVelocity: VelocityComponent
  readonly newAcceleration: AccelerationComponent
}

/**
 * Bulk physics data for SoA processing
 */
interface BulkPhysicsData {
  readonly entityIds: readonly number[]
  readonly positions: readonly PositionComponent[]
  readonly velocities: readonly VelocityComponent[]
  readonly accelerations: readonly AccelerationComponent[]
  readonly masses: readonly MassComponent[]
  readonly isGrounded: readonly boolean[]
}

/**
 * Default physics configuration
 */
export const defaultPhysicsConfig: PhysicsConfig = {
  enableGravity: true,
  enableFriction: true,
  enableAirResistance: true,
  gravityScale: 1.0,
  frictionScale: 1.0,
  maxVelocity: TERMINAL_VELOCITY,
  timeStep: 1 / 60,
  spatialPartitioning: true,
}

/**
 * Advanced physics calculations using vectorized operations
 */
class PhysicsProcessor {
  constructor(private config: PhysicsConfig) {}

  /**
   * Process physics for all entities using bulk operations
   */
  processBulkPhysics(data: BulkPhysicsData, deltaTime: number): PhysicsResult[] {
    const results: PhysicsResult[] = []

    // Vectorized physics calculations for better performance
    for (let i = 0; i < data.entityIds.length; i++) {
      const position = data.positions[i]
      const velocity = data.velocities[i]
      const acceleration = data.accelerations[i]
      const mass = data.masses[i]
      const isGrounded = data.isGrounded[i]

      // Calculate new acceleration (F = ma, a = F/m)
      const gravityForce = this.config.enableGravity ? this.calculateGravity(mass, isGrounded) : { x: 0, y: 0, z: 0 }
      const airResistanceForce = this.config.enableAirResistance ? this.calculateAirResistance(velocity) : { x: 0, y: 0, z: 0 }
      
      const newAcceleration: AccelerationComponent = {
        x: toFloat((gravityForce.x + airResistanceForce.x) / mass.value),
        y: toFloat((gravityForce.y + airResistanceForce.y) / mass.value),
        z: toFloat((gravityForce.z + airResistanceForce.z) / mass.value),
      }

      // Integrate acceleration into velocity (Euler integration)
      let newVelocityX = velocity.x + acceleration.x * deltaTime
      let newVelocityY = velocity.y + acceleration.y * deltaTime
      let newVelocityZ = velocity.z + acceleration.z * deltaTime

      // Apply friction if grounded
      if (this.config.enableFriction && isGrounded) {
        const frictionFactor = Math.pow(FRICTION, deltaTime * this.config.frictionScale)
        newVelocityX *= frictionFactor
        newVelocityZ *= frictionFactor
      }

      // Clamp velocity to maximum
      const velocityMagnitude = Math.sqrt(
        newVelocityX * newVelocityX + 
        newVelocityY * newVelocityY + 
        newVelocityZ * newVelocityZ
      )
      
      if (velocityMagnitude > this.config.maxVelocity) {
        const scale = this.config.maxVelocity / velocityMagnitude
        newVelocityX *= scale
        newVelocityY *= scale
        newVelocityZ *= scale
      }

      const newVelocity: VelocityComponent = {
        x: toFloat(newVelocityX),
        y: toFloat(newVelocityY),
        z: toFloat(newVelocityZ),
      }

      // Integrate velocity into position (Euler integration)
      const newPosition: PositionComponent = {
        x: toFloat(position.x + newVelocity.x * deltaTime),
        y: toFloat(position.y + newVelocity.y * deltaTime),
        z: toFloat(position.z + newVelocity.z * deltaTime),
      }

      results.push({
        newPosition,
        newVelocity,
        newAcceleration,
      })
    }

    return results
  }

  /**
   * Calculate gravity force
   */
  private calculateGravity(mass: MassComponent, isGrounded: boolean): { x: number, y: number, z: number } {
    if (isGrounded) {
      return { x: 0, y: 0, z: 0 }
    }

    return {
      x: 0,
      y: -GRAVITY * mass.value * this.config.gravityScale,
      z: 0,
    }
  }

  /**
   * Calculate air resistance force
   */
  private calculateAirResistance(velocity: VelocityComponent): { x: number, y: number, z: number } {
    const resistance = AIR_RESISTANCE
    
    return {
      x: -velocity.x * Math.abs(velocity.x) * resistance,
      y: -velocity.y * Math.abs(velocity.y) * resistance,
      z: -velocity.z * Math.abs(velocity.z) * resistance,
    }
  }
}

/**
 * Create optimized physics system
 */
export const createPhysicsSystem = (
  config: Partial<PhysicsConfig> = {}
): SystemFunction => {
  const physicsConfig = { ...defaultPhysicsConfig, ...config }
  const processor = new PhysicsProcessor(physicsConfig)

  return (context: SystemContext) => Effect.gen(function* ($) {
    const world = yield* $(World)
    const spatialGrid = yield* $(SpatialGrid)
    
    const startTime = Date.now()

    // Use optimized archetype query for physics entities
    const physicsQuery = ArchetypeQuery.create()
      .with('position', 'velocity', 'acceleration', 'mass')
      .maybe('collider', 'player')
      .execute()

    // Extract bulk physics data using SoA approach
    const bulkData: BulkPhysicsData = {
      entityIds: physicsQuery.entities,
      positions: physicsQuery.entities.map(entityId => 
        physicsQuery.getComponent<PositionComponent>(entityId, 'position')
      ).filter(opt => opt._tag === 'Some').map(opt => (opt as any).value),
      velocities: physicsQuery.entities.map(entityId => 
        physicsQuery.getComponent<VelocityComponent>(entityId, 'velocity')
      ).filter(opt => opt._tag === 'Some').map(opt => (opt as any).value),
      accelerations: physicsQuery.entities.map(entityId => 
        physicsQuery.getComponent<AccelerationComponent>(entityId, 'acceleration')
      ).filter(opt => opt._tag === 'Some').map(opt => (opt as any).value),
      masses: physicsQuery.entities.map(entityId => 
        physicsQuery.getComponent<MassComponent>(entityId, 'mass')
      ).filter(opt => opt._tag === 'Some').map(opt => (opt as any).value),
      isGrounded: physicsQuery.entities.map(entityId => {
        const player = physicsQuery.getComponent<any>(entityId, 'player')
        return player._tag === 'Some' ? player.value.isGrounded : false
      }),
    }

    // Process physics in bulk
    const results = processor.processBulkPhysics(bulkData, context.deltaTime)

    // Apply results back to world
    yield* $(
      Effect.forEach(
        results,
        (result, index) => Effect.gen(function* ($) {
          const entityId = bulkData.entityIds[index]
          
          // Update components
          yield* $(world.updateComponent(entityId, 'position', result.newPosition))
          yield* $(world.updateComponent(entityId, 'velocity', result.newVelocity))
          yield* $(world.updateComponent(entityId, 'acceleration', result.newAcceleration))

          // Update spatial partitioning if enabled
          if (physicsConfig.spatialPartitioning) {
            const collider = physicsQuery.getComponent<ColliderComponent>(entityId, 'collider')
            if (collider._tag === 'Some') {
              const aabb = createAABB(result.newPosition, collider.value)
              yield* $(spatialGrid.add(entityId, aabb))
            }
          }
        }),
        { 
          concurrency: 'inherit',
          discard: true
        }
      )
    )

    // Performance tracking
    const endTime = Date.now()
    const executionTime = endTime - startTime
    trackPerformance('physics', 'read', executionTime)

    // Log performance metrics for debugging
    if (context.frameId % 60 === 0) { // Log every second at 60 FPS
      console.debug(`Physics System - Processed ${bulkData.entityIds.length} entities in ${executionTime}ms`)
    }
  })
}

/**
 * System configuration for physics
 */
export const physicsSystemConfig: SystemConfig = {
  id: 'physics',
  name: 'Physics System',
  priority: 'high',
  phase: 'physics',
  dependencies: ['input'],
  conflicts: [],
  maxExecutionTime: Duration.millis(8), // Target 8ms max execution time for 60fps
  enableProfiling: true,
}

/**
 * Default physics system instance
 */
export const physicsSystem = createPhysicsSystem()

/**
 * Physics system variants for different scenarios
 */
export const physicsSystemVariants = {
  /**
   * High-performance physics with minimal features
   */
  minimal: createPhysicsSystem({
    enableAirResistance: false,
    enableFriction: false,
    spatialPartitioning: false,
  }),

  /**
   * Full-featured physics with all optimizations
   */
  full: createPhysicsSystem({
    enableGravity: true,
    enableFriction: true,
    enableAirResistance: true,
    spatialPartitioning: true,
    gravityScale: 1.2,
    frictionScale: 0.8,
  }),

  /**
   * Debug physics with extended limits
   */
  debug: createPhysicsSystem({
    maxVelocity: TERMINAL_VELOCITY * 2,
    timeStep: 1 / 120, // Higher precision for debugging
  }),
}

/**
 * Physics system utilities
 */
export const PhysicsUtils = {
  /**
   * Calculate physics step with custom timestep
   */
  customStep: (customDeltaTime: number) => createPhysicsSystem({
    timeStep: customDeltaTime
  }),

  /**
   * Create physics system with performance profile
   */
  withProfile: (profile: 'low' | 'medium' | 'high') => {
    const configs = {
      low: {
        enableAirResistance: false,
        spatialPartitioning: false,
      },
      medium: {
        enableAirResistance: true,
        spatialPartitioning: false,
      },
      high: {
        enableAirResistance: true,
        spatialPartitioning: true,
      },
    }
    
    return createPhysicsSystem(configs[profile])
  },
}