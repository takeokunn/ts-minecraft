/**
 * PhysicsDomainService - Pure domain physics logic without infrastructure dependencies
 *
 * Features:
 * - Physics calculations and domain rules
 * - Collision detection algorithms
 * - Physics material calculations
 * - Pure domain logic with port interfaces
 * - No infrastructure dependencies
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as Data from 'effect/Data'
import * as HashMap from 'effect/HashMap'
import * as Array from 'effect/Array'
import * as Option from 'effect/Option'
import * as HashSet from 'effect/HashSet'
import * as Ref from 'effect/Ref'

// Core imports
import { EntityId } from '@domain/entities'
import { Vector3, Position } from '@domain/value-objects'
import { CollisionDetectionError, PhysicsSimulationError, RigidBodyError, GravityError, ConstraintViolationError, RaycastError, PhysicsMaterialError } from '@domain/errors'

// Port interfaces for external dependencies
export interface PhysicsPort {
  readonly calculateAABB: (position: Position, size: Vector3) => Effect.Effect<AABB, never, never>
  readonly broadPhaseCollision: (entities: readonly EntityId[]) => Effect.Effect<readonly CollisionPair[], never, never>
}

export interface AABB {
  readonly minX: number
  readonly minY: number
  readonly minZ: number
  readonly maxX: number
  readonly maxY: number
  readonly maxZ: number
}

// ===== PHYSICS DOMAIN SERVICE INTERFACE =====

export interface PhysicsDomainServiceInterface {
  // Rigid body management
  readonly createRigidBody: (entityId: EntityId, bodyDef: RigidBodyDefinition) => Effect.Effect<RigidBodyId, typeof RigidBodyError, never>
  readonly destroyRigidBody: (bodyId: RigidBodyId) => Effect.Effect<void, typeof RigidBodyError, never>
  readonly getRigidBody: (bodyId: RigidBodyId) => Effect.Effect<RigidBody, typeof RigidBodyError, never>
  readonly updateRigidBody: (bodyId: RigidBodyId, updates: Partial<RigidBodyState>) => Effect.Effect<void, typeof RigidBodyError, never>

  // Physics simulation
  readonly step: (deltaTime: number) => Effect.Effect<PhysicsStepResult, typeof PhysicsSimulationError, never>
  readonly setGravity: (gravity: Vector3) => Effect.Effect<void, typeof GravityError, never>
  readonly getGravity: () => Effect.Effect<Vector3, never, never>
  readonly setTimeScale: (scale: number) => Effect.Effect<void, typeof PhysicsSimulationError, never>

  // Collision detection
  readonly checkCollisions: () => Effect.Effect<readonly CollisionPair[], typeof CollisionDetectionError, never>
  readonly testCollision: (bodyA: RigidBodyId, bodyB: RigidBodyId) => Effect.Effect<CollisionResult, typeof CollisionDetectionError, never>
  readonly getCollisionPairs: (bodyId: RigidBodyId) => Effect.Effect<readonly RigidBodyId[], never, never>

  // Ray casting
  readonly raycast: (ray: Ray, options?: RaycastOptions) => Effect.Effect<RaycastResult, typeof RaycastError, never>
  readonly raycastAll: (ray: Ray, options?: RaycastOptions) => Effect.Effect<readonly RaycastHit[], typeof RaycastError, never>
  readonly sphereCast: (sphere: Sphere, direction: Vector3, maxDistance: number) => Effect.Effect<SpherecastResult, typeof RaycastError, never>

  // Shape queries
  readonly overlapSphere: (sphere: Sphere) => Effect.Effect<readonly RigidBodyId[], never, never>
  readonly overlapBox: (box: OrientedBox) => Effect.Effect<readonly RigidBodyId[], never, never>
  readonly getClosestPoint: (point: Vector3, bodyId: RigidBodyId) => Effect.Effect<Vector3, typeof RigidBodyError, never>

  // Constraints and joints
  readonly createConstraint: (constraintDef: ConstraintDefinition) => Effect.Effect<ConstraintId, typeof ConstraintViolationError, never>
  readonly destroyConstraint: (constraintId: ConstraintId) => Effect.Effect<void, typeof ConstraintViolationError, never>
  readonly updateConstraint: (constraintId: ConstraintId, params: ConstraintParameters) => Effect.Effect<void, typeof ConstraintViolationError, never>

  // Physics materials
  readonly createMaterial: (materialDef: PhysicsMaterialDefinition) => Effect.Effect<PhysicsMaterialId, typeof PhysicsMaterialError, never>
  readonly destroyMaterial: (materialId: PhysicsMaterialId) => Effect.Effect<void, typeof PhysicsMaterialError, never>
  readonly assignMaterial: (bodyId: RigidBodyId, materialId: PhysicsMaterialId) => Effect.Effect<void, typeof RigidBodyError | typeof PhysicsMaterialError, never>

  // Performance and debugging
  readonly getPhysicsStats: () => Effect.Effect<PhysicsStats, never, never>
  readonly enableDebugVisualization: (enabled: boolean) => Effect.Effect<void, never, never>
  readonly getDebugData: () => Effect.Effect<PhysicsDebugData, never, never>

  // Missing query methods used by handlers
  readonly getEntityVelocity: (entityId: EntityId) => Effect.Effect<Vector3, never, never>
  readonly isEntityGrounded: (entityId: EntityId) => Effect.Effect<boolean, never, never>
  readonly getAllPhysicsObjects: () => Effect.Effect<readonly any[], never, never>
}

// ===== SUPPORTING TYPES =====

export type RigidBodyId = string & { readonly _brand: 'RigidBodyId' }
export type ConstraintId = string & { readonly _brand: 'ConstraintId' }
export type PhysicsMaterialId = string & { readonly _brand: 'PhysicsMaterialId' }

export interface Vector3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface Quaternion {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly w: number
}

export interface RigidBodyDefinition {
  readonly entityId: EntityId
  readonly bodyType: BodyType
  readonly position: Vector3
  readonly rotation: Quaternion
  readonly shape: CollisionShape
  readonly mass: number
  readonly material?: PhysicsMaterialId
  readonly kinematic?: boolean
  readonly sensor?: boolean
}

export interface RigidBodyState {
  readonly position: Vector3
  readonly rotation: Quaternion
  readonly linearVelocity: Vector3
  readonly angularVelocity: Vector3
  readonly force: Vector3
  readonly torque: Vector3
}

export interface RigidBody {
  readonly id: RigidBodyId
  readonly entityId: EntityId
  readonly definition: RigidBodyDefinition
  readonly state: RigidBodyState
  readonly shape: CollisionShape
  readonly material: Option.Option<PhysicsMaterialId>
  readonly isActive: boolean
  readonly sleepState: SleepState
}

export type BodyType = 'static' | 'dynamic' | 'kinematic'
export type SleepState = 'awake' | 'sleeping' | 'canSleep'

export interface CollisionShape {
  readonly type: ShapeType
  readonly data: ShapeData
}

export type ShapeType = 'sphere' | 'box' | 'capsule' | 'mesh' | 'heightfield'

export interface ShapeData {
  readonly sphere?: { radius: number }
  readonly box?: { halfExtents: Vector3 }
  readonly capsule?: { radius: number; height: number }
  readonly mesh?: { vertices: readonly Vector3[]; indices: readonly number[] }
  readonly heightfield?: { heights: readonly number[][]; scale: Vector3 }
}

export interface PhysicsStepResult {
  readonly deltaTime: number
  readonly substeps: number
  readonly bodiesUpdated: number
  readonly constraintsSolved: number
  readonly collisionsProcessed: number
  readonly simulationTime: number
}

export interface CollisionPair {
  readonly bodyA: RigidBodyId
  readonly bodyB: RigidBodyId
  readonly contactPoints: readonly ContactPoint[]
  readonly separatingVelocity: number
  readonly penetrationDepth: number
}

export interface ContactPoint {
  readonly position: Vector3
  readonly normal: Vector3
  readonly penetration: number
  readonly friction: number
  readonly restitution: number
}

export interface CollisionResult {
  readonly isColliding: boolean
  readonly contactPoints: readonly ContactPoint[]
  readonly separationDistance: number
  readonly normal: Vector3
}

export interface Ray {
  readonly origin: Vector3
  readonly direction: Vector3
}

export interface RaycastOptions {
  readonly maxDistance?: number
  readonly layerMask?: number
  readonly ignoreBackfaces?: boolean
  readonly ignoreBodies?: readonly RigidBodyId[]
}

export interface RaycastResult {
  readonly hit: boolean
  readonly hitPoint: Option.Option<Vector3>
  readonly hitNormal: Option.Option<Vector3>
  readonly hitBody: Option.Option<RigidBodyId>
  readonly distance: number
}

export interface RaycastHit {
  readonly point: Vector3
  readonly normal: Vector3
  readonly body: RigidBodyId
  readonly distance: number
  readonly triangleIndex?: number
}

export interface Sphere {
  readonly center: Vector3
  readonly radius: number
}

export interface OrientedBox {
  readonly center: Vector3
  readonly halfExtents: Vector3
  readonly rotation: Quaternion
}

export interface SpherecastResult {
  readonly hit: boolean
  readonly hitPoint: Option.Option<Vector3>
  readonly hitNormal: Option.Option<Vector3>
  readonly hitBody: Option.Option<RigidBodyId>
  readonly distance: number
  readonly penetration: number
}

export interface ConstraintDefinition {
  readonly type: ConstraintType
  readonly bodyA: RigidBodyId
  readonly bodyB: RigidBodyId
  readonly anchorA: Vector3
  readonly anchorB: Vector3
  readonly parameters: ConstraintParameters
}

export type ConstraintType = 'hinge' | 'slider' | 'fixed' | 'spring' | 'distance'

export interface ConstraintParameters {
  readonly lowerLimit?: number
  readonly upperLimit?: number
  readonly stiffness?: number
  readonly damping?: number
  readonly breakForce?: number
}

export interface PhysicsMaterialDefinition {
  readonly name: string
  readonly friction: number
  readonly restitution: number
  readonly density: number
  readonly frictionCombine: CombineMode
  readonly restitutionCombine: CombineMode
}

export type CombineMode = 'average' | 'minimum' | 'maximum' | 'multiply'

export interface PhysicsStats {
  readonly totalBodies: number
  readonly activeBodies: number
  readonly sleepingBodies: number
  readonly totalConstraints: number
  readonly islandsCount: number
  readonly averageSimulationTime: number
  readonly memoryUsage: PhysicsMemoryUsage
  readonly performanceMetrics: PhysicsPerformanceMetrics
}

export interface PhysicsMemoryUsage {
  readonly rigidBodiesMemory: number
  readonly constraintsMemory: number
  readonly collisionDataMemory: number
  readonly spatialIndexMemory: number
  readonly totalMemory: number
}

export interface PhysicsPerformanceMetrics {
  readonly stepsPerSecond: number
  readonly averageStepTime: number
  readonly collisionDetectionTime: number
  readonly constraintSolvingTime: number
  readonly integrationTime: number
}

export interface PhysicsDebugData {
  readonly bodies: readonly DebugRigidBody[]
  readonly constraints: readonly DebugConstraint[]
  readonly collisions: readonly DebugCollision[]
  readonly spatialPartitions: readonly DebugSpatialPartition[]
}

export interface DebugRigidBody {
  readonly id: RigidBodyId
  readonly position: Vector3
  readonly rotation: Quaternion
  readonly shape: CollisionShape
  readonly isActive: boolean
  readonly color: DebugColor
}

export interface DebugConstraint {
  readonly id: ConstraintId
  readonly bodyA: RigidBodyId
  readonly bodyB: RigidBodyId
  readonly anchorA: Vector3
  readonly anchorB: Vector3
  readonly color: DebugColor
}

export interface DebugCollision {
  readonly bodyA: RigidBodyId
  readonly bodyB: RigidBodyId
  readonly contactPoints: readonly Vector3[]
  readonly normal: Vector3
}

export interface DebugSpatialPartition {
  readonly bounds: AABB
  readonly bodyCount: number
}

export interface DebugColor {
  readonly r: number
  readonly g: number
  readonly b: number
  readonly a: number
}

// ===== PHYSICS DOMAIN SERVICE FUNCTIONAL IMPLEMENTATION =====

export interface PhysicsServiceState {
  readonly rigidBodies: HashMap.HashMap<RigidBodyId, RigidBody>
  readonly constraints: HashMap.HashMap<ConstraintId, Constraint>
  readonly materials: HashMap.HashMap<PhysicsMaterialId, PhysicsMaterial>
  readonly spatialIndex: ReturnType<typeof SpatialIndex.create>
  readonly gravity: Vector3
  readonly timeScale: number
  readonly debugEnabled: boolean
  readonly nextId: number
  readonly physicsStats: PhysicsStats
}

export const PhysicsDomainService = Context.GenericTag<PhysicsDomainServiceInterface>('PhysicsDomainService')

export const PhysicsDomainServiceLive = Layer.effect(
  PhysicsDomainService,
  Effect.gen(function* () {
    // Create initial state
    const stateRef = yield* Ref.make<PhysicsServiceState>({
      rigidBodies: HashMap.empty(),
      constraints: HashMap.empty(),
      materials: HashMap.empty(),
      spatialIndex: SpatialIndex.create(),
      gravity: { x: 0, y: -9.81, z: 0 },
      timeScale: 1.0,
      debugEnabled: false,
      nextId: 0,
      physicsStats: {
        totalSteps: 0,
        totalSimulationTime: 0,
        avgStepTime: 0,
        bodiesProcessed: 0,
        constraintsSolved: 0,
      }
    })

    // Configuration constants
    const MAX_SUBSTEPS = 10
    const FIXED_TIMESTEP = 1 / 60
    const SLEEP_THRESHOLD = 0.01

    // Helper functions
    const generateId = (): Effect.Effect<string, never, never> => 
      Ref.modify(stateRef, (state) => [(state.nextId + 1).toString(), { ...state, nextId: state.nextId + 1 }])

    const createRigidBodyId = (id: string): RigidBodyId => id as RigidBodyId
    const createConstraintId = (id: string): ConstraintId => id as ConstraintId
    const createMaterialId = (id: string): PhysicsMaterialId => id as PhysicsMaterialId

    // Vector math utilities
    const vectorAdd = (a: Vector3, b: Vector3): Vector3 => ({
      x: a.x + b.x,
      y: a.y + b.y,
      z: a.z + b.z,
    })

    const vectorScale = (v: Vector3, scale: number): Vector3 => ({
      x: v.x * scale,
      y: v.y * scale,
      z: v.z * scale,
    })

    const vectorLength = (v: Vector3): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)

    const _vectorNormalize = (v: Vector3): Vector3 => {
      const length = vectorLength(v)
      return length > 0 ? vectorScale(v, 1 / length) : { x: 0, y: 0, z: 0 }
    }

    const vectorDot = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z

    // Rigid body management implementation
    const createRigidBody = (entityId: EntityId, bodyDef: RigidBodyDefinition): Effect.Effect<RigidBodyId, typeof RigidBodyError, never> =>
      Effect.gen(function* () {
        const id = createRigidBodyId(yield* generateId())

        // Validate body definition
        if (!bodyDef.shape || !bodyDef.position || typeof bodyDef.mass !== 'number' || bodyDef.mass < 0) {
          return yield* Effect.fail(
            RigidBodyError({
              message: 'Invalid rigid body definition provided',
              entityId,
              bodyId: id
            }),
          )
        }

        const rigidBody: RigidBody = {
          id,
          entityId,
          definition: bodyDef,
          state: {
            position: bodyDef.position,
            rotation: bodyDef.rotation,
            linearVelocity: { x: 0, y: 0, z: 0 },
            angularVelocity: { x: 0, y: 0, z: 0 },
            force: { x: 0, y: 0, z: 0 },
            torque: { x: 0, y: 0, z: 0 },
          },
          shape: bodyDef.shape,
          material: Option.fromNullable(bodyDef.material),
          isActive: true,
          sleepState: 'awake',
        }

        yield* Ref.update(stateRef, (state) => ({
          ...state,
          rigidBodies: HashMap.set(state.rigidBodies, id, rigidBody)
        }))

        // Update spatial index
        const state = yield* Ref.get(stateRef)
        const bounds = calculateBounds(rigidBody)
        state.spatialIndex.insert(id, bounds)

        return id
      })

      const destroyRigidBody = (bodyId: RigidBodyId): Effect.Effect<void, typeof RigidBodyError, never> =>
        Effect.gen(function* () {
          const bodies = yield* Ref.get(rigidBodies)
          const body = HashMap.get(bodies, bodyId)

          if (Option.isNone(body)) {
            return yield* Effect.fail(
              RigidBodyError({
                message: `Rigid body not found: ${bodyId}`,
                bodyId,
              }),
            )
          }

          yield* Ref.update(rigidBodies, HashMap.remove(bodyId))

          // Remove from spatial index
          const currentIndex = yield* Ref.get(spatialIndex)
          currentIndex.remove(bodyId)
        })

      const getRigidBody = (bodyId: RigidBodyId): Effect.Effect<RigidBody, typeof RigidBodyError, never> =>
        Effect.gen(function* () {
          const bodies = yield* Ref.get(rigidBodies)
          const body = HashMap.get(bodies, bodyId)

          return Option.match(body, {
            onNone: () =>
              RigidBodyError({
                message: `Rigid body not found: ${bodyId}`,
                bodyId,
              }),
            onSome: (body) => body,
          })
        }).pipe(Effect.flatMap(Effect.succeed))

      // Physics simulation implementation
      const step = (deltaTime: number): Effect.Effect<PhysicsStepResult, typeof PhysicsSimulationError, never> =>
        Effect.gen(function* () {
          const startTime = Date.now()
          const scale = yield* Ref.get(timeScale)
          const scaledDeltaTime = deltaTime * scale

          let substeps = 0
          let remainingTime = scaledDeltaTime
          let bodiesUpdated = 0
          let constraintsSolved = 0
          let collisionsProcessed = 0

          // Validate deltaTime
          if (deltaTime <= 0 || !Number.isFinite(deltaTime)) {
            return yield* Effect.fail(
              PhysicsSimulationError({
                message: 'Invalid deltaTime - must be positive and finite',
                deltaTime: scaledDeltaTime
              })
            )
          }

          // Substep simulation for stability
          while (remainingTime > 0 && substeps < MAX_SUBSTEPS) {
            const stepTime = Math.min(remainingTime, FIXED_TIMESTEP)

            // Integration step
            yield* integrateRigidBodies(stepTime)

            // Collision detection
            const collisionPairs = yield* detectCollisions()
            collisionsProcessed += collisionPairs.length

            // Constraint solving
            const constraintCount = yield* solveConstraints(stepTime)
            constraintsSolved += constraintCount

            // Collision response
            yield* resolveCollisions(collisionPairs, stepTime)

            // Update spatial index
            yield* updateSpatialIndex()

            remainingTime -= stepTime
            substeps++
          }

          const bodies = yield* Ref.get(rigidBodies)
          bodiesUpdated = HashMap.size(bodies)

          const simulationTime = Date.now() - startTime
          yield* updatePhysicsStats(simulationTime)

          return {
            deltaTime: scaledDeltaTime,
            substeps,
            bodiesUpdated,
            constraintsSolved,
            collisionsProcessed,
            simulationTime,
          }
        })

      // Collision detection implementation
      const checkCollisions = (): Effect.Effect<readonly CollisionPair[], typeof CollisionDetectionError, never> =>
        Effect.gen(function* () {
          const bodies = yield* Ref.get(rigidBodies)
          const collisionPairs: CollisionPair[] = []

          // Broad phase collision detection using spatial index
          const currentIndex = yield* Ref.get(spatialIndex)
          
          if (!currentIndex) {
            return yield* Effect.fail(
              CollisionDetectionError({
                message: 'Spatial index not available for collision detection',
                affectedBodies: []
              })
            )
          }

          const broadPhasePairs = currentIndex.getBroadPhasePairs()

          // Narrow phase collision detection
          for (const [bodyAId, bodyBId] of broadPhasePairs) {
            const bodyA = HashMap.get(bodies, bodyAId)
            const bodyB = HashMap.get(bodies, bodyBId)

            if (Option.isSome(bodyA) && Option.isSome(bodyB)) {
              const collision = yield* testCollisionBetweenBodies(bodyA.value, bodyB.value)
              if (collision.isColliding) {
                collisionPairs.push({
                  bodyA: bodyAId,
                  bodyB: bodyBId,
                  contactPoints: collision.contactPoints,
                  separatingVelocity: calculateSeparatingVelocity(bodyA.value, bodyB.value, collision.normal),
                  penetrationDepth: collision.contactPoints.length > 0 ? collision.contactPoints[0].penetration : 0,
                })
              }
            }
          }

          return collisionPairs
        })

      const raycast = (ray: Ray, options: RaycastOptions = {}): Effect.Effect<RaycastResult, typeof RaycastError, never> =>
        Effect.gen(function* () {
          // Validate ray parameters
          if (!ray.origin || !ray.direction) {
            return yield* Effect.fail(
              RaycastError({
                message: 'Invalid ray parameters - origin and direction required',
                ray,
                maxDistance: options.maxDistance ?? 1000
              })
            )
          }

          const maxDistance = options.maxDistance ?? 1000
          const ignoreBackfaces = options.ignoreBackfaces ?? false
          const ignoreBodies = HashSet.fromIterable(options.ignoreBodies ?? [])

          if (maxDistance <= 0) {
            return yield* Effect.fail(
              RaycastError({
                message: 'Invalid max distance - must be positive',
                ray,
                maxDistance
              })
            )
          }

          const bodies = yield* Ref.get(rigidBodies)
          let closestHit: RaycastHit | null = null
          let closestDistance = maxDistance

          // Test ray against all bodies
          for (const body of HashMap.values(bodies)) {
            if (HashSet.has(ignoreBodies, body.id)) continue

            const hitResult = testRayAgainstBody(ray, body, ignoreBackfaces)
            if (hitResult && hitResult.distance < closestDistance) {
              closestDistance = hitResult.distance
              closestHit = hitResult
            }
          }

          return {
            hit: closestHit !== null,
            hitPoint: closestHit ? Option.some(closestHit.point) : Option.none(),
            hitNormal: closestHit ? Option.some(closestHit.normal) : Option.none(),
            hitBody: closestHit ? Option.some(closestHit.body) : Option.none(),
            distance: closestDistance,
          }
        })

      // Physics material management
      const createMaterial = (materialDef: PhysicsMaterialDefinition): Effect.Effect<PhysicsMaterialId, typeof PhysicsMaterialError, never> =>
        Effect.gen(function* () {
          // Validate material definition
          if (!materialDef.name || typeof materialDef.name !== 'string') {
            return yield* Effect.fail(
              PhysicsMaterialError({
                message: 'Invalid material definition - name is required',
                materialName: materialDef.name || '<undefined>'
              })
            )
          }

          if (materialDef.friction < 0 || materialDef.restitution < 0 || materialDef.density <= 0) {
            return yield* Effect.fail(
              PhysicsMaterialError({
                message: 'Invalid material properties - friction/restitution must be non-negative, density must be positive',
                materialName: materialDef.name
              })
            )
          }

          const id = createMaterialId(yield* generateId())

          const material: PhysicsMaterial = {
            id,
            definition: materialDef,
          }

          yield* Ref.update(materials, HashMap.set(id, material))
          return id
        })

      // Helper function implementations
      const integrateRigidBodies = (_deltaTime: number): Effect.Effect<void, never, never> =>
        Effect.gen(function* () {
          const bodies = yield* Ref.get(rigidBodies)
          const currentGravity = yield* Ref.get(gravity)

          const updatedBodies = HashMap.map(bodies, (body: RigidBody) => {
            if (body.definition.bodyType !== 'dynamic' || !body.isActive) {
              return body
            }

            // Apply gravity
            const gravityForce = vectorScale(currentGravity, body.definition.mass)
            const totalForce = vectorAdd(body.state.force, gravityForce)

            // Integrate velocity
            const acceleration = vectorScale(totalForce, 1 / body.definition.mass)
            const newLinearVelocity = vectorAdd(body.state.linearVelocity, vectorScale(acceleration, deltaTime))

            // Integrate position
            const deltaPosition = vectorScale(newLinearVelocity, deltaTime)
            const newPosition = vectorAdd(body.state.position, deltaPosition)

            // Update sleep state
            const speed = vectorLength(newLinearVelocity)
            const newSleepState = speed < SLEEP_THRESHOLD ? 'canSleep' : 'awake'

            return Data.struct({
              ...body,
              state: {
                ...body.state,
                position: newPosition,
                linearVelocity: newLinearVelocity,
                force: { x: 0, y: 0, z: 0 }, // Reset forces
              },
              sleepState: newSleepState,
              isActive: newSleepState === 'awake',
            })
          })

          yield* Ref.set(rigidBodies, updatedBodies)
        })

      const detectCollisions = (): Effect.Effect<readonly CollisionPair[], never, never> => checkCollisions().pipe(Effect.catchAll(() => Effect.succeed([])))

      const solveConstraints = (deltaTime: number): Effect.Effect<number, never, never> =>
        Effect.gen(function* () {
          const currentConstraints = yield* Ref.get(constraints)
          const constraintArray = Array.fromIterable(HashMap.values(currentConstraints))

          // Solve each constraint
          for (const constraint of constraintArray) {
            yield* solveConstraint(constraint, deltaTime)
          }

          return constraintArray.length
        })

      const resolveCollisions = (collisionPairs: readonly CollisionPair[], deltaTime: number): Effect.Effect<void, never, never> =>
        Effect.gen(function* () {
          const bodies = yield* Ref.get(rigidBodies)

          for (const collision of collisionPairs) {
            const bodyA = HashMap.get(bodies, collision.bodyA)
            const bodyB = HashMap.get(bodies, collision.bodyB)

            if (Option.isSome(bodyA) && Option.isSome(bodyB)) {
              yield* resolveCollisionPair(bodyA.value, bodyB.value, collision)
            }
          }
        })

      const updateSpatialIndex = (): Effect.Effect<void, never, never> =>
        Effect.gen(function* () {
          const bodies = yield* Ref.get(rigidBodies)
          const currentIndex = yield* Ref.get(spatialIndex)

          currentIndex.clear()

          for (const body of HashMap.values(bodies)) {
            const bounds = calculateBounds(body)
            currentIndex.insert(body.id, bounds)
          }
        })

      const updatePhysicsStats = (simulationTime: number): Effect.Effect<void, never, never> =>
        Ref.update(physicsStats, (stats) =>
          Data.struct({
            ...stats,
            totalSteps: stats.totalSteps + 1,
            totalSimulationTime: stats.totalSimulationTime + simulationTime,
            avgStepTime: (stats.totalSimulationTime + simulationTime) / (stats.totalSteps + 1),
          }),
        )

      // Additional helper function stubs (would be fully implemented)
      const testCollisionBetweenBodies = (bodyA: RigidBody, bodyB: RigidBody): Effect.Effect<CollisionResult, never, never> =>
        Effect.succeed({
          isColliding: false,
          contactPoints: [],
          separationDistance: 0,
          normal: { x: 0, y: 1, z: 0 },
        })

      const calculateSeparatingVelocity = (bodyA: RigidBody, bodyB: RigidBody, normal: Vector3): number =>
        vectorDot(vectorAdd(bodyA.state.linearVelocity, vectorScale(bodyB.state.linearVelocity, -1)), normal)

      const testRayAgainstBody = (_ray: Ray, _body: RigidBody, _ignoreBackfaces: boolean): RaycastHit | null => null // Implementation would perform actual ray-shape intersection

      const solveConstraint = (_constraint: Constraint, _deltaTime: number): Effect.Effect<void, never, never> => Effect.succeed(undefined)

      const resolveCollisionPair = (_bodyA: RigidBody, _bodyB: RigidBody, _collision: CollisionPair): Effect.Effect<void, never, never> => Effect.succeed(undefined)

      const calculateBounds = (body: RigidBody): AABB => ({
        minX: body.state.position.x - 1,
        minY: body.state.position.y - 1,
        minZ: body.state.position.z - 1,
        maxX: body.state.position.x + 1,
        maxY: body.state.position.y + 1,
        maxZ: body.state.position.z + 1,
      })

      // Return the service implementation
      return {
        createRigidBody,
        destroyRigidBody,
        getRigidBody,
        updateRigidBody: (bodyId: RigidBodyId, updates: Partial<RigidBodyState>) =>
          Effect.gen(function* () {
            const body = yield* getRigidBody(bodyId)
            const updatedState = { ...body.state, ...updates }
            const updatedBody = Data.struct({ ...body, state: updatedState })
            yield* Ref.update(rigidBodies, HashMap.set(bodyId, updatedBody))
          }),

        step,
        setGravity: (newGravity: Vector3) => Ref.set(gravity, newGravity),
        getGravity: () => Ref.get(gravity),
        setTimeScale: (scale: number) =>
          scale > 0 && scale <= 10 ? Ref.set(timeScale, scale) : Effect.fail(PhysicsSimulationError({ message: `Invalid time scale: ${scale}`, timeScale: scale })),

        checkCollisions,
        testCollision: (bodyA: RigidBodyId, bodyB: RigidBodyId) =>
          Effect.gen(function* () {
            const bodyAObj = yield* getRigidBody(bodyA)
            const bodyBObj = yield* getRigidBody(bodyB)
            return yield* testCollisionBetweenBodies(bodyAObj, bodyBObj)
          }),
        getCollisionPairs: (bodyId: RigidBodyId) =>
          Effect.gen(function* () {
            const collisions = yield* checkCollisions().pipe(Effect.catchAll(() => Effect.succeed([])))
            return collisions.filter((pair) => pair.bodyA === bodyId || pair.bodyB === bodyId).map((pair) => (pair.bodyA === bodyId ? pair.bodyB : pair.bodyA))
          }),

        raycast,
        raycastAll: () =>
          // Would return all hits instead of just the closest
          Effect.succeed([]),
        sphereCast: (maxDistance: number) =>
          Effect.succeed({
            hit: false,
            hitPoint: Option.none(),
            hitNormal: Option.none(),
            hitBody: Option.none(),
            distance: maxDistance,
            penetration: 0,
          }),

        overlapSphere: () => Effect.succeed([]),
        overlapBox: () => Effect.succeed([]),
        getClosestPoint: (point: Vector3) => Effect.succeed(point),

        createConstraint: () =>
          Effect.gen(function* () {
            const id = createConstraintId(yield* generateId())
            // Implementation would create actual constraint
            return id
          }),
        destroyConstraint: () => Effect.succeed(undefined),
        updateConstraint: () => Effect.succeed(undefined),

        createMaterial,
        destroyMaterial: (materialId: PhysicsMaterialId) => Ref.update(materials, HashMap.remove(materialId)),
        assignMaterial: (bodyId: RigidBodyId, materialId: PhysicsMaterialId) =>
          Effect.gen(function* () {
            const body = yield* getRigidBody(bodyId)
            const updatedBody = Data.struct({ ...body, material: Option.some(materialId) })
            yield* Ref.update(rigidBodies, HashMap.set(bodyId, updatedBody))
          }),

        getPhysicsStats: () =>
          Effect.gen(function* () {
            const bodies = yield* Ref.get(rigidBodies)
            const currentConstraints = yield* Ref.get(constraints)
            const stats = yield* Ref.get(physicsStats)

            const activeBodies = Array.fromIterable(HashMap.values(bodies)).filter((body) => body.isActive).length

            return {
              totalBodies: HashMap.size(bodies),
              activeBodies,
              sleepingBodies: HashMap.size(bodies) - activeBodies,
              totalConstraints: HashMap.size(currentConstraints),
              islandsCount: 1, // Simplified
              averageSimulationTime: stats.avgStepTime,
              memoryUsage: {
                rigidBodiesMemory: HashMap.size(bodies) * 256,
                constraintsMemory: HashMap.size(currentConstraints) * 128,
                collisionDataMemory: 1024, // Estimate
                spatialIndexMemory: 2048, // Estimate
                totalMemory: HashMap.size(bodies) * 256 + HashMap.size(currentConstraints) * 128 + 3072,
              },
              performanceMetrics: {
                stepsPerSecond: stats.avgStepTime > 0 ? 1000 / stats.avgStepTime : 0,
                averageStepTime: stats.avgStepTime,
                collisionDetectionTime: stats.avgStepTime * 0.3, // Estimate
                constraintSolvingTime: stats.avgStepTime * 0.2, // Estimate
                integrationTime: stats.avgStepTime * 0.5, // Estimate
              },
            }
          }),

        enableDebugVisualization: (enabled: boolean) => Ref.set(debugEnabled, enabled),
        getDebugData: () =>
          Effect.gen(function* () {
            const bodies = yield* Ref.get(rigidBodies)

            return {
              bodies: Array.fromIterable(HashMap.values(bodies)).map((body) => ({
                id: body.id,
                position: body.state.position,
                rotation: body.state.rotation,
                shape: body.shape,
                isActive: body.isActive,
                color: { r: 1, g: 1, b: 1, a: 1 },
              })),
              constraints: [], // Would map constraints
              collisions: [], // Would show current collisions
              spatialPartitions: [], // Would show spatial index structure
            }
          }),

        // Missing query methods used by handlers
        getEntityVelocity: (entityId) =>
          Effect.gen(function* () {
            // TODO: Get velocity from rigid body - returning mock for now
            return { x: 0, y: 0, z: 0 }
          }),

        isEntityGrounded: (entityId) =>
          Effect.gen(function* () {
            // TODO: Check if entity is on ground - returning mock for now
            return true
          }),

        getAllPhysicsObjects: () =>
          Effect.gen(function* () {
            const bodies = yield* Ref.get(rigidBodies)
            return Array.fromIterable(HashMap.values(bodies))
          }),
      }
    }),
  )

// Supporting functional implementations
export const SpatialIndex = {
  create: () => ({
    entries: new Map<string, AABB>(),
    insert: function(id: RigidBodyId, bounds: AABB): void {
      this.entries.set(id, bounds)
    },
    remove: function(id: RigidBodyId): void {
      this.entries.delete(id)
    },
    clear: function(): void {
      this.entries.clear()
    },
    getBroadPhasePairs: function(): Array<[RigidBodyId, RigidBodyId]> {
      return []
    }
  })
}

interface Constraint {
  readonly id: ConstraintId
  readonly definition: ConstraintDefinition
  readonly parameters: ConstraintParameters
}

interface PhysicsMaterial {
  readonly id: PhysicsMaterialId
  readonly definition: PhysicsMaterialDefinition
}

// Dependencies would be handled by proper service composition in real implementation
