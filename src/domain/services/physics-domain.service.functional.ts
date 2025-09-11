/**
 * Physics Domain Service - Functional Effect-TS Implementation
 *
 * This service handles all physics-related domain logic including:
 * - Collision detection and response
 * - Gravity and movement calculations
 * - Physics state management
 * - Velocity and acceleration computations
 * 
 * FUNCTIONAL IMPLEMENTATION:
 * - Replaces PhysicsDomainService class with pure functions
 * - Uses Effect-TS Context.GenericTag and Layer pattern
 * - All operations return Effect types
 * - Uses Ref.Ref for state management
 * - Eliminates mutable class state
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as Data from 'effect/Data'
import * as HashMap from 'effect/HashMap'
import * as Array from 'effect/Array'
import * as Option from 'effect/Option'
import * as Ref from 'effect/Ref'

// Core imports
import { EntityId } from '@domain/entities'
import { Position, Vector3 } from '@domain/value-objects'
import { PhysicsError, CollisionError } from '@domain/errors'

/**
 * Physics component data
 */
export interface PhysicsComponent {
  readonly position: Position
  readonly velocity: Vector3
  readonly acceleration: Vector3
  readonly mass: number
  readonly friction: number
  readonly bounciness: number
  readonly isKinematic: boolean
  readonly isGrounded: boolean
}

/**
 * Collision data
 */
export interface CollisionData {
  readonly entityA: EntityId
  readonly entityB: EntityId
  readonly contactPoint: Position
  readonly normal: Vector3
  readonly penetrationDepth: number
  readonly timestamp: number
}

/**
 * Physics configuration
 */
export interface PhysicsConfig {
  readonly gravity: Vector3
  readonly airResistance: number
  readonly groundFriction: number
  readonly timeStep: number
  readonly maxVelocity: Vector3
  readonly collisionIterations: number
}

/**
 * Physics state
 */
interface PhysicsState {
  readonly config: PhysicsConfig
  readonly entities: HashMap.HashMap<EntityId, PhysicsComponent>
  readonly collisions: Array<CollisionData>
  readonly lastUpdate: number
}

/**
 * Physics domain service interface (functional)
 */
export interface IPhysicsDomainServiceFunctional {
  // Core physics operations
  readonly applyGravity: (entityId: EntityId, deltaTime: number) => Effect.Effect<void, PhysicsError, never>
  readonly updateVelocity: (entityId: EntityId, deltaTime: number) => Effect.Effect<void, PhysicsError, never>
  readonly updatePosition: (entityId: EntityId, deltaTime: number) => Effect.Effect<void, PhysicsError, never>
  readonly applyForce: (entityId: EntityId, force: Vector3) => Effect.Effect<void, PhysicsError, never>
  readonly applyImpulse: (entityId: EntityId, impulse: Vector3) => Effect.Effect<void, PhysicsError, never>

  // Physics component management
  readonly addPhysicsComponent: (entityId: EntityId, component: PhysicsComponent) => Effect.Effect<void, never, never>
  readonly removePhysicsComponent: (entityId: EntityId) => Effect.Effect<void, never, never>
  readonly getPhysicsComponent: (entityId: EntityId) => Effect.Effect<Option.Option<PhysicsComponent>, never, never>
  readonly updatePhysicsComponent: (
    entityId: EntityId, 
    updater: (component: PhysicsComponent) => PhysicsComponent
  ) => Effect.Effect<void, PhysicsError, never>

  // Collision detection and response
  readonly checkCollisions: () => Effect.Effect<ReadonlyArray<CollisionData>, never, never>
  readonly resolveCollision: (collision: CollisionData) => Effect.Effect<void, CollisionError, never>
  readonly isCollidingWith: (entityA: EntityId, entityB: EntityId) => Effect.Effect<boolean, never, never>

  // Physics queries
  readonly getEntitiesInRadius: (center: Position, radius: number) => Effect.Effect<ReadonlyArray<EntityId>, never, never>
  readonly raycast: (origin: Position, direction: Vector3, maxDistance: number) => Effect.Effect<Option.Option<EntityId>, never, never>
  readonly getVelocity: (entityId: EntityId) => Effect.Effect<Vector3, PhysicsError, never>
  readonly setVelocity: (entityId: EntityId, velocity: Vector3) => Effect.Effect<void, PhysicsError, never>

  // Simulation control
  readonly simulatePhysics: (deltaTime: number) => Effect.Effect<void, never, never>
  readonly resetPhysics: () => Effect.Effect<void, never, never>
  readonly pausePhysics: () => Effect.Effect<void, never, never>
  readonly resumePhysics: () => Effect.Effect<void, never, never>

  // Configuration
  readonly updateConfig: (config: Partial<PhysicsConfig>) => Effect.Effect<void, never, never>
  readonly getConfig: () => Effect.Effect<PhysicsConfig, never, never>
}

/**
 * Physics domain service tag
 */
export const PhysicsDomainServiceFunctional = Context.GenericTag<IPhysicsDomainServiceFunctional>('PhysicsDomainServiceFunctional')

/**
 * Default physics configuration
 */
export const defaultPhysicsConfig: PhysicsConfig = {
  gravity: { x: 0, y: -9.81, z: 0 },
  airResistance: 0.01,
  groundFriction: 0.1,
  timeStep: 1/60,
  maxVelocity: { x: 100, y: 100, z: 100 },
  collisionIterations: 3,
}

/**
 * Physics error constructors
 */
export class PhysicsEntityNotFoundError extends Data.TaggedError('PhysicsEntityNotFoundError')<{
  readonly entityId: EntityId
}> {}

export class InvalidPhysicsComponentError extends Data.TaggedError('InvalidPhysicsComponentError')<{
  readonly entityId: EntityId
  readonly reason: string
}> {}

export class PhysicsSimulationError extends Data.TaggedError('PhysicsSimulationError')<{
  readonly reason: string
}> {}

/**
 * Apply gravity to physics component
 */
export const applyGravityEffect = (
  stateRef: Ref.Ref<PhysicsState>,
  entityId: EntityId,
  deltaTime: number,
): Effect.Effect<void, PhysicsEntityNotFoundError, never> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    const componentOpt = HashMap.get(state.entities, entityId)
    
    if (Option.isNone(componentOpt)) {
      return yield* Effect.fail(new PhysicsEntityNotFoundError({ entityId }))
    }

    const component = componentOpt.value
    if (component.isKinematic) {
      return // Kinematic bodies are not affected by gravity
    }

    const gravityForce = {
      x: state.config.gravity.x * component.mass * deltaTime,
      y: state.config.gravity.y * component.mass * deltaTime,
      z: state.config.gravity.z * component.mass * deltaTime,
    }

    const newAcceleration = {
      x: component.acceleration.x + gravityForce.x / component.mass,
      y: component.acceleration.y + gravityForce.y / component.mass,
      z: component.acceleration.z + gravityForce.z / component.mass,
    }

    const updatedComponent = {
      ...component,
      acceleration: newAcceleration,
    }

    yield* Ref.update(stateRef, (s) => ({
      ...s,
      entities: HashMap.set(s.entities, entityId, updatedComponent),
    }))
  })

/**
 * Update velocity based on acceleration
 */
export const updateVelocityEffect = (
  stateRef: Ref.Ref<PhysicsState>,
  entityId: EntityId,
  deltaTime: number,
): Effect.Effect<void, PhysicsEntityNotFoundError, never> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    const componentOpt = HashMap.get(state.entities, entityId)
    
    if (Option.isNone(componentOpt)) {
      return yield* Effect.fail(new PhysicsEntityNotFoundError({ entityId }))
    }

    const component = componentOpt.value

    // Apply acceleration to velocity
    let newVelocity = {
      x: component.velocity.x + component.acceleration.x * deltaTime,
      y: component.velocity.y + component.acceleration.y * deltaTime,
      z: component.velocity.z + component.acceleration.z * deltaTime,
    }

    // Apply air resistance
    const resistance = state.config.airResistance
    newVelocity = {
      x: newVelocity.x * (1 - resistance),
      y: newVelocity.y * (1 - resistance),
      z: newVelocity.z * (1 - resistance),
    }

    // Apply ground friction if grounded
    if (component.isGrounded) {
      const friction = state.config.groundFriction
      newVelocity = {
        x: newVelocity.x * (1 - friction),
        y: newVelocity.y,
        z: newVelocity.z * (1 - friction),
      }
    }

    // Clamp velocity to maximum
    const maxVel = state.config.maxVelocity
    newVelocity = {
      x: Math.max(-maxVel.x, Math.min(maxVel.x, newVelocity.x)),
      y: Math.max(-maxVel.y, Math.min(maxVel.y, newVelocity.y)),
      z: Math.max(-maxVel.z, Math.min(maxVel.z, newVelocity.z)),
    }

    // Reset acceleration after applying
    const updatedComponent = {
      ...component,
      velocity: newVelocity,
      acceleration: { x: 0, y: 0, z: 0 },
    }

    yield* Ref.update(stateRef, (s) => ({
      ...s,
      entities: HashMap.set(s.entities, entityId, updatedComponent),
    }))
  })

/**
 * Update position based on velocity
 */
export const updatePositionEffect = (
  stateRef: Ref.Ref<PhysicsState>,
  entityId: EntityId,
  deltaTime: number,
): Effect.Effect<void, PhysicsEntityNotFoundError, never> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    const componentOpt = HashMap.get(state.entities, entityId)
    
    if (Option.isNone(componentOpt)) {
      return yield* Effect.fail(new PhysicsEntityNotFoundError({ entityId }))
    }

    const component = componentOpt.value

    const newPosition = {
      x: component.position.x + component.velocity.x * deltaTime,
      y: component.position.y + component.velocity.y * deltaTime,
      z: component.position.z + component.velocity.z * deltaTime,
    }

    const updatedComponent = {
      ...component,
      position: newPosition,
    }

    yield* Ref.update(stateRef, (s) => ({
      ...s,
      entities: HashMap.set(s.entities, entityId, updatedComponent),
    }))
  })

/**
 * Apply force to physics component
 */
export const applyForceEffect = (
  stateRef: Ref.Ref<PhysicsState>,
  entityId: EntityId,
  force: Vector3,
): Effect.Effect<void, PhysicsEntityNotFoundError, never> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    const componentOpt = HashMap.get(state.entities, entityId)
    
    if (Option.isNone(componentOpt)) {
      return yield* Effect.fail(new PhysicsEntityNotFoundError({ entityId }))
    }

    const component = componentOpt.value
    if (component.isKinematic) {
      return // Kinematic bodies don't respond to forces
    }

    // F = ma, so a = F/m
    const acceleration = {
      x: force.x / component.mass,
      y: force.y / component.mass,
      z: force.z / component.mass,
    }

    const newAcceleration = {
      x: component.acceleration.x + acceleration.x,
      y: component.acceleration.y + acceleration.y,
      z: component.acceleration.z + acceleration.z,
    }

    const updatedComponent = {
      ...component,
      acceleration: newAcceleration,
    }

    yield* Ref.update(stateRef, (s) => ({
      ...s,
      entities: HashMap.set(s.entities, entityId, updatedComponent),
    }))
  })

/**
 * Apply impulse to physics component
 */
export const applyImpulseEffect = (
  stateRef: Ref.Ref<PhysicsState>,
  entityId: EntityId,
  impulse: Vector3,
): Effect.Effect<void, PhysicsEntityNotFoundError, never> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    const componentOpt = HashMap.get(state.entities, entityId)
    
    if (Option.isNone(componentOpt)) {
      return yield* Effect.fail(new PhysicsEntityNotFoundError({ entityId }))
    }

    const component = componentOpt.value
    if (component.isKinematic) {
      return // Kinematic bodies don't respond to impulses
    }

    // Impulse = change in momentum = mass * change in velocity
    // So change in velocity = impulse / mass
    const velocityChange = {
      x: impulse.x / component.mass,
      y: impulse.y / component.mass,
      z: impulse.z / component.mass,
    }

    const newVelocity = {
      x: component.velocity.x + velocityChange.x,
      y: component.velocity.y + velocityChange.y,
      z: component.velocity.z + velocityChange.z,
    }

    const updatedComponent = {
      ...component,
      velocity: newVelocity,
    }

    yield* Ref.update(stateRef, (s) => ({
      ...s,
      entities: HashMap.set(s.entities, entityId, updatedComponent),
    }))
  })

/**
 * Add physics component to entity
 */
export const addPhysicsComponentEffect = (
  stateRef: Ref.Ref<PhysicsState>,
  entityId: EntityId,
  component: PhysicsComponent,
): Effect.Effect<void, never, never> =>
  Ref.update(stateRef, (s) => ({
    ...s,
    entities: HashMap.set(s.entities, entityId, component),
  }))

/**
 * Remove physics component from entity
 */
export const removePhysicsComponentEffect = (
  stateRef: Ref.Ref<PhysicsState>,
  entityId: EntityId,
): Effect.Effect<void, never, never> =>
  Ref.update(stateRef, (s) => ({
    ...s,
    entities: HashMap.remove(s.entities, entityId),
  }))

/**
 * Get physics component for entity
 */
export const getPhysicsComponentEffect = (
  stateRef: Ref.Ref<PhysicsState>,
  entityId: EntityId,
): Effect.Effect<Option.Option<PhysicsComponent>, never, never> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    return HashMap.get(state.entities, entityId)
  })

/**
 * Update physics component
 */
export const updatePhysicsComponentEffect = (
  stateRef: Ref.Ref<PhysicsState>,
  entityId: EntityId,
  updater: (component: PhysicsComponent) => PhysicsComponent,
): Effect.Effect<void, PhysicsEntityNotFoundError, never> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    const componentOpt = HashMap.get(state.entities, entityId)
    
    if (Option.isNone(componentOpt)) {
      return yield* Effect.fail(new PhysicsEntityNotFoundError({ entityId }))
    }

    const updatedComponent = updater(componentOpt.value)

    yield* Ref.update(stateRef, (s) => ({
      ...s,
      entities: HashMap.set(s.entities, entityId, updatedComponent),
    }))
  })

/**
 * Check for collisions between all entities
 */
export const checkCollisionsEffect = (
  stateRef: Ref.Ref<PhysicsState>,
): Effect.Effect<ReadonlyArray<CollisionData>, never, never> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    const collisions: CollisionData[] = []
    const entities = Array.from(state.entities)
    
    // Simple O(n²) collision detection for demonstration
    // In a real system, you'd use spatial partitioning
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const [entityA, componentA] = entities[i]
        const [entityB, componentB] = entities[j]
        
        // Simple sphere collision detection
        const dx = componentA.position.x - componentB.position.x
        const dy = componentA.position.y - componentB.position.y
        const dz = componentA.position.z - componentB.position.z
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
        
        // Assume radius of 1 for all entities for simplicity
        const radiusA = 1.0
        const radiusB = 1.0
        
        if (distance < radiusA + radiusB) {
          const normal = distance > 0 ? {
            x: dx / distance,
            y: dy / distance,
            z: dz / distance,
          } : { x: 1, y: 0, z: 0 }
          
          const contactPoint = {
            x: componentA.position.x - normal.x * radiusA,
            y: componentA.position.y - normal.y * radiusA,
            z: componentA.position.z - normal.z * radiusA,
          }
          
          collisions.push({
            entityA,
            entityB,
            contactPoint,
            normal,
            penetrationDepth: radiusA + radiusB - distance,
            timestamp: Date.now(),
          })
        }
      }
    }
    
    return collisions
  })

/**
 * Resolve a collision between two entities
 */
export const resolveCollisionEffect = (
  stateRef: Ref.Ref<PhysicsState>,
  collision: CollisionData,
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    const componentAOpt = HashMap.get(state.entities, collision.entityA)
    const componentBOpt = HashMap.get(state.entities, collision.entityB)
    
    if (Option.isNone(componentAOpt) || Option.isNone(componentBOpt)) {
      return // One of the entities no longer exists
    }

    const componentA = componentAOpt.value
    const componentB = componentBOpt.value
    
    // Don't resolve if both are kinematic
    if (componentA.isKinematic && componentB.isKinematic) {
      return
    }

    const { normal, penetrationDepth } = collision
    
    // Separate the entities
    const separationA = componentA.isKinematic ? 0 : penetrationDepth / 2
    const separationB = componentB.isKinematic ? 0 : penetrationDepth / 2
    
    const newPositionA = {
      x: componentA.position.x + normal.x * separationA,
      y: componentA.position.y + normal.y * separationA,
      z: componentA.position.z + normal.z * separationA,
    }
    
    const newPositionB = {
      x: componentB.position.x - normal.x * separationB,
      y: componentB.position.y - normal.y * separationB,
      z: componentB.position.z - normal.z * separationB,
    }

    // Calculate collision response velocities
    const relativeVelocity = {
      x: componentA.velocity.x - componentB.velocity.x,
      y: componentA.velocity.y - componentB.velocity.y,
      z: componentA.velocity.z - componentB.velocity.z,
    }

    const velocityAlongNormal = 
      relativeVelocity.x * normal.x + 
      relativeVelocity.y * normal.y + 
      relativeVelocity.z * normal.z

    if (velocityAlongNormal > 0) {
      return // Objects separating
    }

    // Calculate restitution (bounciness)
    const restitution = Math.min(componentA.bounciness, componentB.bounciness)
    const impulseScalar = -(1 + restitution) * velocityAlongNormal
    const totalMass = componentA.mass + componentB.mass
    const impulse = impulseScalar / totalMass

    const newVelocityA = componentA.isKinematic ? componentA.velocity : {
      x: componentA.velocity.x + impulse * normal.x / componentA.mass,
      y: componentA.velocity.y + impulse * normal.y / componentA.mass,
      z: componentA.velocity.z + impulse * normal.z / componentA.mass,
    }

    const newVelocityB = componentB.isKinematic ? componentB.velocity : {
      x: componentB.velocity.x - impulse * normal.x / componentB.mass,
      y: componentB.velocity.y - impulse * normal.y / componentB.mass,
      z: componentB.velocity.z - impulse * normal.z / componentB.mass,
    }

    const updatedComponentA = {
      ...componentA,
      position: newPositionA,
      velocity: newVelocityA,
    }

    const updatedComponentB = {
      ...componentB,
      position: newPositionB,
      velocity: newVelocityB,
    }

    yield* Ref.update(stateRef, (s) => ({
      ...s,
      entities: HashMap.set(HashMap.set(s.entities, collision.entityA, updatedComponentA), collision.entityB, updatedComponentB),
    }))
  })

/**
 * Simulate physics for one time step
 */
export const simulatePhysicsEffect = (
  stateRef: Ref.Ref<PhysicsState>,
  deltaTime: number,
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    const entityIds = Array.from(state.entities).map(([id]) => id)
    
    // Apply physics to all entities
    for (const entityId of entityIds) {
      yield* applyGravityEffect(stateRef, entityId, deltaTime).pipe(Effect.orElse(() => Effect.void))
      yield* updateVelocityEffect(stateRef, entityId, deltaTime).pipe(Effect.orElse(() => Effect.void))
      yield* updatePositionEffect(stateRef, entityId, deltaTime).pipe(Effect.orElse(() => Effect.void))
    }
    
    // Handle collisions
    const collisions = yield* checkCollisionsEffect(stateRef)
    for (const collision of collisions) {
      yield* resolveCollisionEffect(stateRef, collision)
    }

    // Update last update timestamp
    yield* Ref.update(stateRef, (s) => ({
      ...s,
      lastUpdate: Date.now(),
    }))
  })

/**
 * Create functional physics domain service implementation
 */
export const makePhysicsDomainService = (
  stateRef: Ref.Ref<PhysicsState>,
): IPhysicsDomainServiceFunctional => ({
  // Core physics operations
  applyGravity: (entityId: EntityId, deltaTime: number) => 
    applyGravityEffect(stateRef, entityId, deltaTime).pipe(Effect.mapError((e) => new PhysicsError({ message: e.message }))),
  updateVelocity: (entityId: EntityId, deltaTime: number) => 
    updateVelocityEffect(stateRef, entityId, deltaTime).pipe(Effect.mapError((e) => new PhysicsError({ message: e.message }))),
  updatePosition: (entityId: EntityId, deltaTime: number) => 
    updatePositionEffect(stateRef, entityId, deltaTime).pipe(Effect.mapError((e) => new PhysicsError({ message: e.message }))),
  applyForce: (entityId: EntityId, force: Vector3) => 
    applyForceEffect(stateRef, entityId, force).pipe(Effect.mapError((e) => new PhysicsError({ message: e.message }))),
  applyImpulse: (entityId: EntityId, impulse: Vector3) => 
    applyImpulseEffect(stateRef, entityId, impulse).pipe(Effect.mapError((e) => new PhysicsError({ message: e.message }))),

  // Physics component management
  addPhysicsComponent: (entityId: EntityId, component: PhysicsComponent) => 
    addPhysicsComponentEffect(stateRef, entityId, component),
  removePhysicsComponent: (entityId: EntityId) => 
    removePhysicsComponentEffect(stateRef, entityId),
  getPhysicsComponent: (entityId: EntityId) => 
    getPhysicsComponentEffect(stateRef, entityId),
  updatePhysicsComponent: (entityId: EntityId, updater: (component: PhysicsComponent) => PhysicsComponent) => 
    updatePhysicsComponentEffect(stateRef, entityId, updater).pipe(Effect.mapError((e) => new PhysicsError({ message: e.message }))),

  // Collision detection and response
  checkCollisions: () => checkCollisionsEffect(stateRef),
  resolveCollision: (collision: CollisionData) => 
    resolveCollisionEffect(stateRef, collision).pipe(Effect.mapError((e) => new CollisionError({ message: e.message }))),
  isCollidingWith: (entityA: EntityId, entityB: EntityId) => 
    Effect.gen(function* () {
      const collisions = yield* checkCollisionsEffect(stateRef)
      return collisions.some(c => 
        (c.entityA === entityA && c.entityB === entityB) ||
        (c.entityA === entityB && c.entityB === entityA)
      )
    }),

  // Physics queries
  getEntitiesInRadius: (center: Position, radius: number) => 
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const entitiesInRadius: EntityId[] = []
      
      for (const [entityId, component] of state.entities) {
        const dx = component.position.x - center.x
        const dy = component.position.y - center.y
        const dz = component.position.z - center.z
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
        
        if (distance <= radius) {
          entitiesInRadius.push(entityId)
        }
      }
      
      return entitiesInRadius
    }),

  raycast: (origin: Position, direction: Vector3, maxDistance: number) => 
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      let closestEntity: EntityId | undefined
      let closestDistance = maxDistance
      
      for (const [entityId, component] of state.entities) {
        // Simple sphere raycast - in reality you'd use more sophisticated algorithms
        const toEntity = {
          x: component.position.x - origin.x,
          y: component.position.y - origin.y,
          z: component.position.z - origin.z,
        }
        
        const projectionLength = 
          toEntity.x * direction.x + 
          toEntity.y * direction.y + 
          toEntity.z * direction.z
        
        if (projectionLength < 0 || projectionLength > maxDistance) {
          continue // Entity is behind ray or too far
        }
        
        const projectionPoint = {
          x: origin.x + direction.x * projectionLength,
          y: origin.y + direction.y * projectionLength,
          z: origin.z + direction.z * projectionLength,
        }
        
        const distanceToProjection = Math.sqrt(
          Math.pow(component.position.x - projectionPoint.x, 2) +
          Math.pow(component.position.y - projectionPoint.y, 2) +
          Math.pow(component.position.z - projectionPoint.z, 2)
        )
        
        // Assume entity radius of 1
        if (distanceToProjection <= 1.0 && projectionLength < closestDistance) {
          closestEntity = entityId
          closestDistance = projectionLength
        }
      }
      
      return Option.fromNullable(closestEntity)
    }),

  getVelocity: (entityId: EntityId) => 
    Effect.gen(function* () {
      const componentOpt = yield* getPhysicsComponentEffect(stateRef, entityId)
      if (Option.isNone(componentOpt)) {
        return yield* Effect.fail(new PhysicsError({ message: `Entity ${entityId} has no physics component` }))
      }
      return componentOpt.value.velocity
    }),

  setVelocity: (entityId: EntityId, velocity: Vector3) => 
    updatePhysicsComponentEffect(stateRef, entityId, (component) => ({ ...component, velocity }))
      .pipe(Effect.mapError((e) => new PhysicsError({ message: e.message }))),

  // Simulation control
  simulatePhysics: (deltaTime: number) => simulatePhysicsEffect(stateRef, deltaTime),
  resetPhysics: () => 
    Ref.update(stateRef, (s) => ({
      ...s,
      entities: HashMap.empty(),
      collisions: [],
      lastUpdate: Date.now(),
    })),
  pausePhysics: () => Effect.void, // Could add pause state if needed
  resumePhysics: () => Effect.void, // Could add pause state if needed

  // Configuration
  updateConfig: (config: Partial<PhysicsConfig>) => 
    Ref.update(stateRef, (s) => ({
      ...s,
      config: { ...s.config, ...config },
    })),
  getConfig: () => 
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return state.config
    }),
})

/**
 * Functional Physics Domain Service Live Layer
 */
export const PhysicsDomainServiceFunctionalLive = Layer.effect(
  PhysicsDomainServiceFunctional,
  Effect.gen(function* () {
    const initialState: PhysicsState = {
      config: defaultPhysicsConfig,
      entities: HashMap.empty(),
      collisions: [],
      lastUpdate: Date.now(),
    }

    const stateRef = yield* Ref.make(initialState)

    return makePhysicsDomainService(stateRef)
  }),
)