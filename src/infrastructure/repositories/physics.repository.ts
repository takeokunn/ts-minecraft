/**
 * Physics Repository Implementation - Specialized repository for physics operations
 *
 * This repository provides physics-specific operations and optimizations,
 * focusing on collision detection, physics bodies management, spatial indexing,
 * and physics simulation state management.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as HashMap from 'effect/HashMap'
import * as HashSet from 'effect/HashSet'
import * as Ref from 'effect/Ref'
import * as Option from 'effect/Option'
import * as Array from 'effect/Array'

import { EntityId } from '@domain/entities'
import { type PositionComponent, type VelocityComponent, type CollisionComponent } from '@domain/entities/components/physics/physics-components'

/**
 * Physics body representation
 */
export interface PhysicsBody {
  readonly entityId: EntityId
  readonly position: PositionComponent
  readonly velocity: VelocityComponent
  readonly collision: CollisionComponent
  readonly mass: number
  readonly isStatic: boolean
  readonly isActive: boolean
  readonly lastUpdated: number
  readonly version: number
}

/**
 * Collision event
 */
export interface CollisionEvent {
  readonly entityA: EntityId
  readonly entityB: EntityId
  readonly contactPoints: ReadonlyArray<{ x: number; y: number; z: number }>
  readonly normal: { x: number; y: number; z: number }
  readonly penetration: number
  readonly timestamp: number
  readonly resolved: boolean
}

/**
 * Spatial region for physics optimization
 */
export interface SpatialRegion {
  readonly minX: number
  readonly minY: number
  readonly minZ: number
  readonly maxX: number
  readonly maxY: number
  readonly maxZ: number
  readonly entities: HashSet.HashSet<EntityId>
}

/**
 * Physics query options
 */
export interface PhysicsQueryOptions {
  readonly region?: {
    readonly minX: number
    readonly minY: number
    readonly minZ: number
    readonly maxX: number
    readonly maxY: number
    readonly maxZ: number
  }
  readonly activeOnly?: boolean
  readonly staticOnly?: boolean
  readonly withCollision?: boolean
  readonly entityIds?: ReadonlyArray<EntityId>
}

/**
 * Physics statistics
 */
export interface PhysicsStats {
  readonly totalBodies: number
  readonly activeBodies: number
  readonly staticBodies: number
  readonly collisionEvents: number
  readonly spatialRegions: number
  readonly averageEntitiesPerRegion: number
  readonly memoryUsage: number
}

/**
 * Physics Repository interface
 */
export interface IPhysicsRepository {
  // Physics body operations
  readonly addPhysicsBody: (body: PhysicsBody) => Effect.Effect<boolean, never, never>
  readonly updatePhysicsBody: (entityId: EntityId, updates: Partial<PhysicsBody>) => Effect.Effect<boolean, never, never>
  readonly removePhysicsBody: (entityId: EntityId) => Effect.Effect<boolean, never, never>
  readonly getPhysicsBody: (entityId: EntityId) => Effect.Effect<Option.Option<PhysicsBody>, never, never>
  readonly hasPhysicsBody: (entityId: EntityId) => Effect.Effect<boolean, never, never>

  // Position operations
  readonly updatePosition: (entityId: EntityId, position: PositionComponent) => Effect.Effect<boolean, never, never>
  readonly updateVelocity: (entityId: EntityId, velocity: VelocityComponent) => Effect.Effect<boolean, never, never>
  readonly getPosition: (entityId: EntityId) => Effect.Effect<Option.Option<PositionComponent>, never, never>
  readonly getVelocity: (entityId: EntityId) => Effect.Effect<Option.Option<VelocityComponent>, never, never>

  // Spatial queries
  readonly findBodiesInRegion: (region: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number }) => Effect.Effect<ReadonlyArray<PhysicsBody>, never, never>
  readonly findBodiesInRadius: (center: { x: number; y: number; z: number }, radius: number) => Effect.Effect<ReadonlyArray<PhysicsBody>, never, never>
  readonly findNearestBodies: (position: { x: number; y: number; z: number }, maxCount: number, maxDistance?: number) => Effect.Effect<ReadonlyArray<{ body: PhysicsBody; distance: number }>, never, never>

  // Collision operations
  readonly detectCollisions: () => Effect.Effect<ReadonlyArray<CollisionEvent>, never, never>
  readonly checkCollision: (entityA: EntityId, entityB: EntityId) => Effect.Effect<Option.Option<CollisionEvent>, never, never>
  readonly getCollisionEvents: (entityId?: EntityId, since?: number) => Effect.Effect<ReadonlyArray<CollisionEvent>, never, never>
  readonly resolveCollision: (event: CollisionEvent) => Effect.Effect<boolean, never, never>

  // Bulk operations
  readonly updateMultipleBodies: (updates: ReadonlyArray<{ entityId: EntityId; updates: Partial<PhysicsBody> }>) => Effect.Effect<number, never, never>
  readonly queryBodies: (options?: PhysicsQueryOptions) => Effect.Effect<ReadonlyArray<PhysicsBody>, never, never>
  readonly activateBodies: (entityIds: ReadonlyArray<EntityId>) => Effect.Effect<number, never, never>
  readonly deactivateBodies: (entityIds: ReadonlyArray<EntityId>) => Effect.Effect<number, never, never>

  // Physics simulation support
  readonly stepSimulation: (deltaTime: number) => Effect.Effect<{ movedBodies: number; collisions: number }, never, never>
  readonly applyForce: (entityId: EntityId, force: { x: number; y: number; z: number }) => Effect.Effect<boolean, never, never>
  readonly applyImpulse: (entityId: EntityId, impulse: { x: number; y: number; z: number }) => Effect.Effect<boolean, never, never>

  // Spatial indexing
  readonly rebuildSpatialIndex: () => Effect.Effect<void, never, never>
  readonly optimizeSpatialIndex: () => Effect.Effect<void, never, never>
  readonly getSpatialRegions: () => Effect.Effect<ReadonlyArray<SpatialRegion>, never, never>

  // Statistics and maintenance
  readonly getPhysicsStats: () => Effect.Effect<PhysicsStats, never, never>
  readonly clearCollisionHistory: (before?: number) => Effect.Effect<number, never, never>
  readonly compactStorage: () => Effect.Effect<void, never, never>
  readonly validatePhysicsData: () => Effect.Effect<{ isValid: boolean; errors: ReadonlyArray<string> }, never, never>
}

export const PhysicsRepository = Context.GenericTag<IPhysicsRepository>('PhysicsRepository')

/**
 * Physics repository state
 */
export interface PhysicsRepositoryState {
  readonly physicsBodies: HashMap.HashMap<EntityId, PhysicsBody>
  readonly collisionEvents: Array<CollisionEvent>
  readonly maxCollisionHistory: number
  readonly spatialIndex: HashMap.HashMap<string, SpatialRegion> // Grid-based spatial index
  readonly spatialGridSize: number
  readonly lastSimulationTime: number
}

/**
 * Helper functions
 */
const getSpatialGridKey = (x: number, y: number, z: number, gridSize: number): string => {
  const gridX = Math.floor(x / gridSize)
  const gridY = Math.floor(y / gridSize)
  const gridZ = Math.floor(z / gridSize)
  return `${gridX},${gridY},${gridZ}`
}

const calculateDistance = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

const checkBoundingBoxCollision = (bodyA: PhysicsBody, bodyB: PhysicsBody): boolean => {
  const aPos = bodyA.position
  const bPos = bodyB.position
  const aCol = bodyA.collision
  const bCol = bodyB.collision

  return (
    aPos.x - aCol.width/2 <= bPos.x + bCol.width/2 &&
    aPos.x + aCol.width/2 >= bPos.x - bCol.width/2 &&
    aPos.y - aCol.height/2 <= bPos.y + bCol.height/2 &&
    aPos.y + aCol.height/2 >= bPos.y - bCol.height/2 &&
    aPos.z - aCol.depth/2 <= bPos.z + bCol.depth/2 &&
    aPos.z + aCol.depth/2 >= bPos.z - bCol.depth/2
  )
}

const createCollisionEvent = (bodyA: PhysicsBody, bodyB: PhysicsBody): CollisionEvent => {
  const aPos = bodyA.position
  const bPos = bodyB.position
  
  // Simple collision normal calculation
  const dx = bPos.x - aPos.x
  const dy = bPos.y - aPos.y
  const dz = bPos.z - aPos.z
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz)
  
  const normal = length > 0 ? { x: dx / length, y: dy / length, z: dz / length } : { x: 0, y: 1, z: 0 }
  
  // Simple penetration calculation
  const aCol = bodyA.collision
  const bCol = bodyB.collision
  const penetration = Math.max(0, (aCol.width + bCol.width) / 2 - Math.abs(dx))
  
  return {
    entityA: bodyA.entityId,
    entityB: bodyB.entityId,
    contactPoints: [{ x: (aPos.x + bPos.x) / 2, y: (aPos.y + bPos.y) / 2, z: (aPos.z + bPos.z) / 2 }],
    normal,
    penetration,
    timestamp: Date.now(),
    resolved: false,
  }
}

/**
 * Physics Repository Implementation
 */
export const createPhysicsRepository = (stateRef: Ref.Ref<PhysicsRepositoryState>): IPhysicsRepository => {
  const addPhysicsBody = (body: PhysicsBody): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      
      if (HashMap.has(state.physicsBodies, body.entityId)) {
        return false
      }

      const gridKey = getSpatialGridKey(body.position.x, body.position.y, body.position.z, state.spatialGridSize)
      const currentRegion = HashMap.get(state.spatialIndex, gridKey)
      
      const newRegion: SpatialRegion = Option.match(currentRegion, {
        onNone: () => ({
          minX: Math.floor(body.position.x / state.spatialGridSize) * state.spatialGridSize,
          minY: Math.floor(body.position.y / state.spatialGridSize) * state.spatialGridSize,
          minZ: Math.floor(body.position.z / state.spatialGridSize) * state.spatialGridSize,
          maxX: Math.floor(body.position.x / state.spatialGridSize) * state.spatialGridSize + state.spatialGridSize,
          maxY: Math.floor(body.position.y / state.spatialGridSize) * state.spatialGridSize + state.spatialGridSize,
          maxZ: Math.floor(body.position.z / state.spatialGridSize) * state.spatialGridSize + state.spatialGridSize,
          entities: HashSet.make(body.entityId),
        }),
        onSome: (region) => ({
          ...region,
          entities: HashSet.add(region.entities, body.entityId),
        })
      })

      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          physicsBodies: HashMap.set(s.physicsBodies, body.entityId, body),
          spatialIndex: HashMap.set(s.spatialIndex, gridKey, newRegion),
        }))
      )

      return true
    })

  const updatePhysicsBody = (entityId: EntityId, updates: Partial<PhysicsBody>): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const existingBody = HashMap.get(state.physicsBodies, entityId)

      if (Option.isNone(existingBody)) {
        return false
      }

      const oldBody = existingBody.value
      const newBody: PhysicsBody = {
        ...oldBody,
        ...updates,
        lastUpdated: Date.now(),
        version: oldBody.version + 1,
      }

      // Update spatial index if position changed
      let newSpatialIndex = state.spatialIndex
      if (updates.position && (updates.position.x !== oldBody.position.x || updates.position.y !== oldBody.position.y || updates.position.z !== oldBody.position.z)) {
        // Remove from old region
        const oldGridKey = getSpatialGridKey(oldBody.position.x, oldBody.position.y, oldBody.position.z, state.spatialGridSize)
        const oldRegion = HashMap.get(state.spatialIndex, oldGridKey)
        if (Option.isSome(oldRegion)) {
          const updatedOldRegion = { ...oldRegion.value, entities: HashSet.remove(oldRegion.value.entities, entityId) }
          newSpatialIndex = HashMap.set(newSpatialIndex, oldGridKey, updatedOldRegion)
        }

        // Add to new region
        const newGridKey = getSpatialGridKey(newBody.position.x, newBody.position.y, newBody.position.z, state.spatialGridSize)
        const newRegion = HashMap.get(newSpatialIndex, newGridKey)
        const updatedNewRegion: SpatialRegion = Option.match(newRegion, {
          onNone: () => ({
            minX: Math.floor(newBody.position.x / state.spatialGridSize) * state.spatialGridSize,
            minY: Math.floor(newBody.position.y / state.spatialGridSize) * state.spatialGridSize,
            minZ: Math.floor(newBody.position.z / state.spatialGridSize) * state.spatialGridSize,
            maxX: Math.floor(newBody.position.x / state.spatialGridSize) * state.spatialGridSize + state.spatialGridSize,
            maxY: Math.floor(newBody.position.y / state.spatialGridSize) * state.spatialGridSize + state.spatialGridSize,
            maxZ: Math.floor(newBody.position.z / state.spatialGridSize) * state.spatialGridSize + state.spatialGridSize,
            entities: HashSet.make(entityId),
          }),
          onSome: (region) => ({
            ...region,
            entities: HashSet.add(region.entities, entityId),
          })
        })
        newSpatialIndex = HashMap.set(newSpatialIndex, newGridKey, updatedNewRegion)
      }

      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          physicsBodies: HashMap.set(s.physicsBodies, entityId, newBody),
          spatialIndex: newSpatialIndex,
        }))
      )

      return true
    })

  const removePhysicsBody = (entityId: EntityId): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const existingBody = HashMap.get(state.physicsBodies, entityId)

      if (Option.isNone(existingBody)) {
        return false
      }

      const body = existingBody.value
      
      // Remove from spatial index
      const gridKey = getSpatialGridKey(body.position.x, body.position.y, body.position.z, state.spatialGridSize)
      const region = HashMap.get(state.spatialIndex, gridKey)
      let newSpatialIndex = state.spatialIndex
      
      if (Option.isSome(region)) {
        const updatedRegion = { ...region.value, entities: HashSet.remove(region.value.entities, entityId) }
        newSpatialIndex = HashMap.set(newSpatialIndex, gridKey, updatedRegion)
      }

      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          physicsBodies: HashMap.remove(s.physicsBodies, entityId),
          spatialIndex: newSpatialIndex,
        }))
      )

      return true
    })

  const getPhysicsBody = (entityId: EntityId): Effect.Effect<Option.Option<PhysicsBody>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      return HashMap.get(state.physicsBodies, entityId)
    })

  const hasPhysicsBody = (entityId: EntityId): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      return HashMap.has(state.physicsBodies, entityId)
    })

  const updatePosition = (entityId: EntityId, position: PositionComponent): Effect.Effect<boolean, never, never> =>
    updatePhysicsBody(entityId, { position })

  const updateVelocity = (entityId: EntityId, velocity: VelocityComponent): Effect.Effect<boolean, never, never> =>
    updatePhysicsBody(entityId, { velocity })

  const getPosition = (entityId: EntityId): Effect.Effect<Option.Option<PositionComponent>, never, never> =>
    Effect.gen(function* (_) {
      const bodyOpt = yield* _(getPhysicsBody(entityId))
      return Option.map(bodyOpt, (body) => body.position)
    })

  const getVelocity = (entityId: EntityId): Effect.Effect<Option.Option<VelocityComponent>, never, never> =>
    Effect.gen(function* (_) {
      const bodyOpt = yield* _(getPhysicsBody(entityId))
      return Option.map(bodyOpt, (body) => body.velocity)
    })

  const findBodiesInRegion = (region: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number }): Effect.Effect<ReadonlyArray<PhysicsBody>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const bodies: PhysicsBody[] = []

      for (const body of HashMap.values(state.physicsBodies)) {
        const pos = body.position
        if (pos.x >= region.minX && pos.x <= region.maxX &&
            pos.y >= region.minY && pos.y <= region.maxY &&
            pos.z >= region.minZ && pos.z <= region.maxZ) {
          bodies.push(body)
        }
      }

      return bodies
    })

  const findBodiesInRadius = (center: { x: number; y: number; z: number }, radius: number): Effect.Effect<ReadonlyArray<PhysicsBody>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const bodies: PhysicsBody[] = []

      for (const body of HashMap.values(state.physicsBodies)) {
        const distance = calculateDistance(center, body.position)
        if (distance <= radius) {
          bodies.push(body)
        }
      }

      return bodies.sort((a, b) => {
        const distA = calculateDistance(center, a.position)
        const distB = calculateDistance(center, b.position)
        return distA - distB
      })
    })

  const findNearestBodies = (position: { x: number; y: number; z: number }, maxCount: number, maxDistance?: number): Effect.Effect<ReadonlyArray<{ body: PhysicsBody; distance: number }>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const bodiesWithDistance: Array<{ body: PhysicsBody; distance: number }> = []

      for (const body of HashMap.values(state.physicsBodies)) {
        const distance = calculateDistance(position, body.position)
        if (!maxDistance || distance <= maxDistance) {
          bodiesWithDistance.push({ body, distance })
        }
      }

      return bodiesWithDistance
        .sort((a, b) => a.distance - b.distance)
        .slice(0, maxCount)
    })

  const detectCollisions = (): Effect.Effect<ReadonlyArray<CollisionEvent>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const collisions: CollisionEvent[] = []
      const bodies = Array.from(HashMap.values(state.physicsBodies))

      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const bodyA = bodies[i]
          const bodyB = bodies[j]

          // Skip if both are static
          if (bodyA.isStatic && bodyB.isStatic) continue
          
          // Skip if either is inactive
          if (!bodyA.isActive || !bodyB.isActive) continue

          if (checkBoundingBoxCollision(bodyA, bodyB)) {
            const collision = createCollisionEvent(bodyA, bodyB)
            collisions.push(collision)
          }
        }
      }

      // Store new collisions
      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          collisionEvents: [...s.collisionEvents.slice(-s.maxCollisionHistory + collisions.length), ...collisions],
        }))
      )

      return collisions
    })

  const checkCollision = (entityA: EntityId, entityB: EntityId): Effect.Effect<Option.Option<CollisionEvent>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const bodyAOpt = HashMap.get(state.physicsBodies, entityA)
      const bodyBOpt = HashMap.get(state.physicsBodies, entityB)

      if (Option.isNone(bodyAOpt) || Option.isNone(bodyBOpt)) {
        return Option.none()
      }

      const bodyA = bodyAOpt.value
      const bodyB = bodyBOpt.value

      if (checkBoundingBoxCollision(bodyA, bodyB)) {
        return Option.some(createCollisionEvent(bodyA, bodyB))
      }

      return Option.none()
    })

  const getCollisionEvents = (entityId?: EntityId, since?: number): Effect.Effect<ReadonlyArray<CollisionEvent>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      let events = state.collisionEvents

      if (entityId) {
        events = events.filter((event) => event.entityA === entityId || event.entityB === entityId)
      }

      if (since) {
        events = events.filter((event) => event.timestamp >= since)
      }

      return events
    })

  const resolveCollision = (event: CollisionEvent): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const bodyAOpt = HashMap.get(state.physicsBodies, event.entityA)
      const bodyBOpt = HashMap.get(state.physicsBodies, event.entityB)

      if (Option.isNone(bodyAOpt) || Option.isNone(bodyBOpt)) {
        return false
      }

      const bodyA = bodyAOpt.value
      const bodyB = bodyBOpt.value

      // Simple collision resolution - separate objects and adjust velocities
      const normal = event.normal
      const penetration = event.penetration

      // Position correction
      const correction = penetration / 2
      const newPositionA: PositionComponent = {
        ...bodyA.position,
        x: bodyA.position.x - normal.x * correction,
        y: bodyA.position.y - normal.y * correction,
        z: bodyA.position.z - normal.z * correction,
      }
      const newPositionB: PositionComponent = {
        ...bodyB.position,
        x: bodyB.position.x + normal.x * correction,
        y: bodyB.position.y + normal.y * correction,
        z: bodyB.position.z + normal.z * correction,
      }

      // Velocity adjustment (simple elastic collision)
      const relativeVelocity = {
        x: bodyB.velocity.x - bodyA.velocity.x,
        y: bodyB.velocity.y - bodyA.velocity.y,
        z: bodyB.velocity.z - bodyA.velocity.z,
      }

      const velocityAlongNormal = relativeVelocity.x * normal.x + relativeVelocity.y * normal.y + relativeVelocity.z * normal.z
      
      if (velocityAlongNormal > 0) return true // Objects separating

      const restitution = 0.8 // Bounciness factor
      const j = -(1 + restitution) * velocityAlongNormal / (1 / bodyA.mass + 1 / bodyB.mass)

      const impulse = { x: j * normal.x, y: j * normal.y, z: j * normal.z }

      const newVelocityA: VelocityComponent = {
        ...bodyA.velocity,
        x: bodyA.velocity.x - impulse.x / bodyA.mass,
        y: bodyA.velocity.y - impulse.y / bodyA.mass,
        z: bodyA.velocity.z - impulse.z / bodyA.mass,
      }

      const newVelocityB: VelocityComponent = {
        ...bodyB.velocity,
        x: bodyB.velocity.x + impulse.x / bodyB.mass,
        y: bodyB.velocity.y + impulse.y / bodyB.mass,
        z: bodyB.velocity.z + impulse.z / bodyB.mass,
      }

      // Update bodies
      yield* _(updatePhysicsBody(event.entityA, { position: newPositionA, velocity: newVelocityA }))
      yield* _(updatePhysicsBody(event.entityB, { position: newPositionB, velocity: newVelocityB }))

      return true
    })

  // Implement remaining methods with simplified logic for brevity
  const updateMultipleBodies = (updates: ReadonlyArray<{ entityId: EntityId; updates: Partial<PhysicsBody> }>): Effect.Effect<number, never, never> =>
    Effect.gen(function* (_) {
      let updatedCount = 0
      for (const update of updates) {
        const updated = yield* _(updatePhysicsBody(update.entityId, update.updates))
        if (updated) updatedCount++
      }
      return updatedCount
    })

  const queryBodies = (options?: PhysicsQueryOptions): Effect.Effect<ReadonlyArray<PhysicsBody>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      let bodies = Array.from(HashMap.values(state.physicsBodies))

      if (options?.activeOnly) {
        bodies = bodies.filter(body => body.isActive)
      }

      if (options?.staticOnly) {
        bodies = bodies.filter(body => body.isStatic)
      }

      if (options?.withCollision) {
        bodies = bodies.filter(body => body.collision)
      }

      if (options?.region) {
        const region = options.region
        bodies = bodies.filter(body => {
          const pos = body.position
          return pos.x >= region.minX && pos.x <= region.maxX &&
                 pos.y >= region.minY && pos.y <= region.maxY &&
                 pos.z >= region.minZ && pos.z <= region.maxZ
        })
      }

      if (options?.entityIds) {
        const entityIdSet = new Set(options.entityIds)
        bodies = bodies.filter(body => entityIdSet.has(body.entityId))
      }

      return bodies
    })

  const activateBodies = (entityIds: ReadonlyArray<EntityId>): Effect.Effect<number, never, never> =>
    Effect.gen(function* (_) {
      let activatedCount = 0
      for (const entityId of entityIds) {
        const activated = yield* _(updatePhysicsBody(entityId, { isActive: true }))
        if (activated) activatedCount++
      }
      return activatedCount
    })

  const deactivateBodies = (entityIds: ReadonlyArray<EntityId>): Effect.Effect<number, never, never> =>
    Effect.gen(function* (_) {
      let deactivatedCount = 0
      for (const entityId of entityIds) {
        const deactivated = yield* _(updatePhysicsBody(entityId, { isActive: false }))
        if (deactivated) deactivatedCount++
      }
      return deactivatedCount
    })

  const stepSimulation = (deltaTime: number): Effect.Effect<{ movedBodies: number; collisions: number }, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      let movedBodies = 0

      // Update positions based on velocities
      for (const body of HashMap.values(state.physicsBodies)) {
        if (body.isActive && !body.isStatic) {
          const newPosition: PositionComponent = {
            ...body.position,
            x: body.position.x + body.velocity.x * deltaTime,
            y: body.position.y + body.velocity.y * deltaTime,
            z: body.position.z + body.velocity.z * deltaTime,
          }

          // Apply gravity
          const gravity = -9.81
          const newVelocity: VelocityComponent = {
            ...body.velocity,
            y: body.velocity.y + gravity * deltaTime,
          }

          yield* _(updatePhysicsBody(body.entityId, { position: newPosition, velocity: newVelocity }))
          movedBodies++
        }
      }

      // Detect and resolve collisions
      const collisions = yield* _(detectCollisions())
      for (const collision of collisions) {
        yield* _(resolveCollision(collision))
      }

      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          lastSimulationTime: Date.now(),
        }))
      )

      return { movedBodies, collisions: collisions.length }
    })

  const applyForce = (entityId: EntityId, force: { x: number; y: number; z: number }): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* (_) {
      const bodyOpt = yield* _(getPhysicsBody(entityId))
      if (Option.isNone(bodyOpt)) return false

      const body = bodyOpt.value
      const acceleration = {
        x: force.x / body.mass,
        y: force.y / body.mass,
        z: force.z / body.mass,
      }

      const newVelocity: VelocityComponent = {
        ...body.velocity,
        x: body.velocity.x + acceleration.x,
        y: body.velocity.y + acceleration.y,
        z: body.velocity.z + acceleration.z,
      }

      return yield* _(updatePhysicsBody(entityId, { velocity: newVelocity }))
    })

  const applyImpulse = (entityId: EntityId, impulse: { x: number; y: number; z: number }): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* (_) {
      const bodyOpt = yield* _(getPhysicsBody(entityId))
      if (Option.isNone(bodyOpt)) return false

      const body = bodyOpt.value
      const velocityChange = {
        x: impulse.x / body.mass,
        y: impulse.y / body.mass,
        z: impulse.z / body.mass,
      }

      const newVelocity: VelocityComponent = {
        ...body.velocity,
        x: body.velocity.x + velocityChange.x,
        y: body.velocity.y + velocityChange.y,
        z: body.velocity.z + velocityChange.z,
      }

      return yield* _(updatePhysicsBody(entityId, { velocity: newVelocity }))
    })

  const rebuildSpatialIndex = (): Effect.Effect<void, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      let newSpatialIndex = HashMap.empty<string, SpatialRegion>()

      for (const body of HashMap.values(state.physicsBodies)) {
        const gridKey = getSpatialGridKey(body.position.x, body.position.y, body.position.z, state.spatialGridSize)
        const currentRegion = HashMap.get(newSpatialIndex, gridKey)
        
        const newRegion: SpatialRegion = Option.match(currentRegion, {
          onNone: () => ({
            minX: Math.floor(body.position.x / state.spatialGridSize) * state.spatialGridSize,
            minY: Math.floor(body.position.y / state.spatialGridSize) * state.spatialGridSize,
            minZ: Math.floor(body.position.z / state.spatialGridSize) * state.spatialGridSize,
            maxX: Math.floor(body.position.x / state.spatialGridSize) * state.spatialGridSize + state.spatialGridSize,
            maxY: Math.floor(body.position.y / state.spatialGridSize) * state.spatialGridSize + state.spatialGridSize,
            maxZ: Math.floor(body.position.z / state.spatialGridSize) * state.spatialGridSize + state.spatialGridSize,
            entities: HashSet.make(body.entityId),
          }),
          onSome: (region) => ({
            ...region,
            entities: HashSet.add(region.entities, body.entityId),
          })
        })

        newSpatialIndex = HashMap.set(newSpatialIndex, gridKey, newRegion)
      }

      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          spatialIndex: newSpatialIndex,
        }))
      )
    })

  const optimizeSpatialIndex = (): Effect.Effect<void, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      // Remove empty regions
      const optimizedIndex = HashMap.filter(state.spatialIndex, (region) => HashSet.size(region.entities) > 0)

      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          spatialIndex: optimizedIndex,
        }))
      )
    })

  const getSpatialRegions = (): Effect.Effect<ReadonlyArray<SpatialRegion>, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      return Array.from(HashMap.values(state.spatialIndex))
    })

  const getPhysicsStats = (): Effect.Effect<PhysicsStats, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const bodies = Array.from(HashMap.values(state.physicsBodies))
      const totalBodies = bodies.length
      const activeBodies = bodies.filter(body => body.isActive).length
      const staticBodies = bodies.filter(body => body.isStatic).length
      const spatialRegions = HashMap.size(state.spatialIndex)
      const averageEntitiesPerRegion = spatialRegions > 0 ? totalBodies / spatialRegions : 0

      return {
        totalBodies,
        activeBodies,
        staticBodies,
        collisionEvents: state.collisionEvents.length,
        spatialRegions,
        averageEntitiesPerRegion,
        memoryUsage: JSON.stringify(state).length,
      }
    })

  const clearCollisionHistory = (before?: number): Effect.Effect<number, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const cutoff = before ?? Date.now()
      const oldEvents = state.collisionEvents.filter((event) => event.timestamp < cutoff)
      const newEvents = state.collisionEvents.filter((event) => event.timestamp >= cutoff)

      yield* _(
        Ref.update(stateRef, (s) => ({
          ...s,
          collisionEvents: newEvents,
        }))
      )

      return oldEvents.length
    })

  const compactStorage = (): Effect.Effect<void, never, never> =>
    Effect.gen(function* (_) {
      yield* _(optimizeSpatialIndex())
      // Additional cleanup could be added here
    })

  const validatePhysicsData = (): Effect.Effect<{ isValid: boolean; errors: ReadonlyArray<string> }, never, never> =>
    Effect.gen(function* (_) {
      const state = yield* _(Ref.get(stateRef))
      const errors: string[] = []

      for (const body of HashMap.values(state.physicsBodies)) {
        // Check for invalid positions
        if (isNaN(body.position.x) || isNaN(body.position.y) || isNaN(body.position.z)) {
          errors.push(`Invalid position for entity ${body.entityId}`)
        }

        // Check for invalid velocities
        if (isNaN(body.velocity.x) || isNaN(body.velocity.y) || isNaN(body.velocity.z)) {
          errors.push(`Invalid velocity for entity ${body.entityId}`)
        }

        // Check for invalid mass
        if (body.mass <= 0) {
          errors.push(`Invalid mass for entity ${body.entityId}`)
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
      }
    })

  // Return the complete implementation
  return {
    addPhysicsBody,
    updatePhysicsBody,
    removePhysicsBody,
    getPhysicsBody,
    hasPhysicsBody,
    updatePosition,
    updateVelocity,
    getPosition,
    getVelocity,
    findBodiesInRegion,
    findBodiesInRadius,
    findNearestBodies,
    detectCollisions,
    checkCollision,
    getCollisionEvents,
    resolveCollision,
    updateMultipleBodies,
    queryBodies,
    activateBodies,
    deactivateBodies,
    stepSimulation,
    applyForce,
    applyImpulse,
    rebuildSpatialIndex,
    optimizeSpatialIndex,
    getSpatialRegions,
    getPhysicsStats,
    clearCollisionHistory,
    compactStorage,
    validatePhysicsData,
  }
}

/**
 * Physics Repository Layer
 */
export const PhysicsRepositoryLive = Layer.effect(
  PhysicsRepository,
  Effect.gen(function* (_) {
    const initialState: PhysicsRepositoryState = {
      physicsBodies: HashMap.empty(),
      collisionEvents: [],
      maxCollisionHistory: 1000,
      spatialIndex: HashMap.empty(),
      spatialGridSize: 32, // 32 unit grid size
      lastSimulationTime: 0,
    }

    const stateRef = yield* _(Ref.make(initialState))

    return createPhysicsRepository(stateRef)
  })
)