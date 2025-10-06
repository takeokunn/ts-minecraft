import { Clock, Effect, Match, pipe } from 'effect'
import { PHYSICS_CONSTANTS } from '@domain/physics/types'
import {
  EpochMillis,
  EpochMillisSchema,
  PhysicsConfig,
  PhysicsConfigSchema,
  PhysicsWorld,
  PhysicsWorldId,
  PhysicsWorldIdSchema,
  PhysicsWorldSchema,
  PhysicsWorldStateSchema,
  Vector3,
  decodeConstant,
  decodeWith,
  parseNonNegativeFloat,
  parsePositiveFloat,
  parseVector3,
  positiveFloat,
  unitInterval,
} from '@domain/physics/types'
import type { PhysicsError } from '@domain/physics/types'

const defaultConfig: PhysicsConfig = decodeConstant(PhysicsConfigSchema)({
  timeStep: positiveFloat(1 / 60),
  maxSubSteps: 3,
  damping: unitInterval(0.02),
  solverIterations: 10,
})

const defaultState = decodeConstant(PhysicsWorldStateSchema)({
  isRunning: false,
  totalTime: 0,
  entityCount: 0,
  activeBodies: 0,
  lastStepAt: 0,
})

const generateId = (prefix: string): Effect.Effect<PhysicsWorldId, PhysicsError> =>
  Effect.flatMap(now(), (millis) => {
    const suffix = String(millis).padStart(8, '0')
    return decodeWith(PhysicsWorldIdSchema)(`${prefix}-${suffix}`)
  })

const now = (): Effect.Effect<EpochMillis, PhysicsError> =>
  Effect.flatMap(Clock.currentTimeMillis, (millis) => decodeWith(EpochMillisSchema)(millis))

const create = (
  params: {
    readonly config?: Partial<PhysicsConfig>
    readonly gravity?: Vector3
  } = {}
): Effect.Effect<PhysicsWorld, PhysicsError> =>
  Effect.gen(function* () {
    const id = yield* generateId('world')
    const createdAt = yield* now()
    const mergedConfig = {
      ...defaultConfig,
      ...params.config,
    }
    const gravityVector = params.gravity ?? PHYSICS_CONSTANTS.gravity

    const world = {
      id,
      config: mergedConfig,
      gravity: gravityVector,
      state: {
        ...defaultState,
        lastStepAt: createdAt,
      },
      createdAt,
      updatedAt: createdAt,
      _tag: 'PhysicsWorld',
    }

    return yield* decodeWith(PhysicsWorldSchema)(world)
  })

const markUpdated = (world: PhysicsWorld): Effect.Effect<PhysicsWorld, PhysicsError> =>
  Effect.map(now(), (timestamp) => ({
    ...world,
    updatedAt: timestamp,
  }))

const setRunning = (world: PhysicsWorld, flag: boolean): Effect.Effect<PhysicsWorld, PhysicsError> =>
  Effect.gen(function* () {
    const timestamp = yield* now()
    const state = yield* decodeWith(PhysicsWorldStateSchema)({
      ...world.state,
      isRunning: flag,
      lastStepAt: timestamp,
    })
    return {
      ...world,
      state,
      updatedAt: timestamp,
    }
  })

const start = (world: PhysicsWorld): Effect.Effect<PhysicsWorld, PhysicsError> =>
  pipe(
    world.state.isRunning,
    Match.value,
    Match.when(true, () => Effect.succeed(world)),
    Match.orElse(() => setRunning(world, true))
  )

const stop = (world: PhysicsWorld): Effect.Effect<PhysicsWorld, PhysicsError> =>
  pipe(
    world.state.isRunning,
    Match.value,
    Match.when(false, () => Effect.succeed(world)),
    Match.orElse(() => setRunning(world, false))
  )

const step = (
  world: PhysicsWorld,
  deltaTime: number,
  activeBodies: number
): Effect.Effect<PhysicsWorld, PhysicsError> =>
  Effect.gen(function* () {
    const dt = yield* parsePositiveFloat(deltaTime)
    const timestamp = yield* now()
    const total = yield* parseNonNegativeFloat(world.state.totalTime + dt)
    const state = yield* decodeWith(PhysicsWorldStateSchema)({
      ...world.state,
      totalTime: total,
      activeBodies,
      lastStepAt: timestamp,
    })

    return {
      ...world,
      state,
      updatedAt: timestamp,
    }
  })

const updateConfig = (world: PhysicsWorld, patch: Partial<PhysicsConfig>): Effect.Effect<PhysicsWorld, PhysicsError> =>
  Effect.gen(function* () {
    const merged = { ...world.config, ...patch }
    const config = yield* decodeWith(PhysicsConfigSchema)(merged)
    return {
      ...world,
      config,
    }
  })

const updateGravity = (world: PhysicsWorld, vector: Vector3): Effect.Effect<PhysicsWorld, PhysicsError> =>
  Effect.map(parseVector3(vector), (gravity) => ({
    ...world,
    gravity,
  }))

const summarize = (world: PhysicsWorld) =>
  `world=${world.id} running=${world.state.isRunning} total=${world.state.totalTime.toFixed(2)} bodies=${world.state.activeBodies}`

export const PhysicsWorldAggregate = {
  schema: PhysicsWorldSchema,
  create,
  start,
  stop,
  step,
  updateConfig,
  updateGravity,
  markUpdated,
  summarize,
}
