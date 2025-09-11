import { Effect, pipe, Ref, Duration } from 'effect'
import { QueryProfiler, queryConfigs } from '@/domain/queries'
// Note: Using queryConfigs instead of queries to avoid application layer dependency
import { FRICTION, GRAVITY, TERMINAL_VELOCITY } from '@/domain/world-constants'
import { WorldRepository } from '@/domain/ports/world.repository'
import { toFloat } from '@/domain/value-objects/common'
import { Position, Velocity } from '@/domain/entities/components'
import { ClockPort } from '@/domain/ports/clock.port'

const applyGravity = (isGrounded: boolean, deltaTime: number, gravityScale = 1.0) => (velocity: Velocity): Velocity => {
  if (isGrounded) {
    return new Velocity({ ...velocity, dy: toFloat(0) })
  }
  const effectiveGravity = GRAVITY * gravityScale
  const newVelDY = Math.max(-TERMINAL_VELOCITY, velocity.dy - effectiveGravity * deltaTime)
  return new Velocity({ ...velocity, dy: toFloat(newVelDY) })
}

const applyFriction = (isGrounded: boolean) => (velocity: Velocity): Velocity => {
  if (!isGrounded) {
    return velocity
  }
  return new Velocity({
    ...velocity,
    dx: toFloat(velocity.dx * FRICTION),
    dz: toFloat(velocity.dz * FRICTION),
  })
}

const updatePosition = (velocity: Velocity, deltaTime: number) => (position: Position): Position => {
  return new Position({
    x: toFloat(position.x + velocity.dx * deltaTime),
    y: toFloat(position.y + velocity.dy * deltaTime),
    z: toFloat(position.z + velocity.dz * deltaTime),
  })
}

export const physicsSystem = Effect.gen(function* ($) {
  const startTime = Date.now()
  const world = yield* $(WorldRepository)
  const clock = yield* $(ClockPort)
  const deltaTime = yield* $(clock.deltaTime())

  if (deltaTime <= 0) {
    return
  }

  // Use optimized query for physics entities
  // Note: This would need to be adapted to use the new query system with queryConfigs.physics
  // const { entities, components } = yield* $(world.querySoA(queries.physics))
  // For now, implementing a placeholder that would need proper query system integration
  const entities: any[] = []
  const components = { player: [], position: [], velocity: [], gravity: [] }
  const { player, position, velocity, gravity } = components

  // Batch physics updates for better performance
  const physicsUpdates: Array<{ entityId: any; velocity: Velocity; position: Position }> = []
  
  for (let i = 0; i < entities.length; i++) {
    const entityId = entities[i]
    const currentPlayer = player[i]
    const currentPosition = position[i]
    const currentVelocity = velocity[i]
    const currentGravity = gravity?.[i] || { scale: 1.0, enabled: true }

    if (!currentGravity.enabled) {
      continue
    }

    const finalVelocity = pipe(
      currentVelocity,
      applyGravity(currentPlayer.isGrounded, deltaTime, currentGravity.scale),
      applyFriction(currentPlayer.isGrounded),
    )

    const newPosition = pipe(currentPosition, updatePosition(finalVelocity, deltaTime))
    
    physicsUpdates.push({
      entityId,
      velocity: finalVelocity,
      position: newPosition,
    })
  }

  // Apply all physics updates in batch
  yield* $(
    Effect.forEach(
      physicsUpdates,
      (update) =>
        Effect.gen(function* ($) {
          yield* $(world.updateComponent(update.entityId, 'velocity', update.velocity))
          yield* $(world.updateComponent(update.entityId, 'position', update.position))
        }),
      { concurrency: 'inherit', discard: true },
    ),
  )

  // Physics updates completed
  // Communication can be handled by application layer

  // Record performance metrics
  const executionTime = Date.now() - startTime
  QueryProfiler.record('physics_system', {
    executionTime,
    entitiesScanned: entities.length,
    entitiesMatched: physicsUpdates.length,
    cacheHits: 0, // This would be populated by the query system
    cacheMisses: 0,
  })
})

/**
 * Enhanced physics system with force application support
 */
export const applyForce = (entityId: any, force: { x: number; y: number; z: number }) =>
  Effect.gen(function* ($) {
    const world = yield* $(World)
    const velocity = yield* $(world.getComponent(entityId, 'velocity'))
    
    if (velocity) {
      const newVelocity = new Velocity({
        dx: toFloat(velocity.dx + force.x),
        dy: toFloat(velocity.dy + force.y),
        dz: toFloat(velocity.dz + force.z),
      })
      
      yield* $(world.updateComponent(entityId, 'velocity', newVelocity))
      
      // Notify other systems about force application
      yield* $(
        globalCommunicationHub.sendMessage(
          'physics_updated',
          { entityId, force, type: 'force_applied' },
          { sender: 'physics', priority: 'high' }
        )
      )
    }
  })

/**
 * Set gravity scale for specific entity
 */
export const setGravityScale = (entityId: any, scale: number) =>
  Effect.gen(function* ($) {
    const world = yield* $(World)
    const gravity = yield* $(world.getComponent(entityId, 'gravity'))
    
    if (gravity) {
      const newGravity = { ...gravity, scale }
      yield* $(world.updateComponent(entityId, 'gravity', newGravity))
    }
  })

/**
 * Physics system utilities
 */
export const PhysicsSystemUtils = {
  applyForce,
  setGravityScale,
  
  /**
   * Calculate kinetic energy for debugging
   */
  calculateKineticEnergy: (velocity: Velocity, mass = 1.0) => {
    const speed = Math.sqrt(velocity.dx * velocity.dx + velocity.dy * velocity.dy + velocity.dz * velocity.dz)
    return 0.5 * mass * speed * speed
  },
  
  /**
   * Check if entity is moving
   */
  isMoving: (velocity: Velocity, threshold = 0.01) => {
    return Math.abs(velocity.dx) > threshold || 
           Math.abs(velocity.dy) > threshold || 
           Math.abs(velocity.dz) > threshold
  },
}

/**
 * Physics system configuration
 */
export const physicsSystemConfig = {
  id: 'physics',
  name: 'Physics System',
  priority: 'high' as const,
  phase: 'physics' as const,
  dependencies: ['player-movement'],
  conflicts: ['collision'],
  maxExecutionTime: Duration.millis(5),
  enableProfiling: true,
}