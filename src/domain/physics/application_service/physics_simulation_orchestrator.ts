import { Array as Arr, Context, Effect, Layer, Match, Ref, pipe } from 'effect'
import { PhysicsWorldAggregate } from '../aggregate'
import { PhysicsSimulationService } from '../domain_service'
import type { AABB, PhysicsConfig, PhysicsWorld, PhysicsWorldId, RigidBody, RigidBodyId } from '@domain/physics/types'
import type { PhysicsError } from '@domain/physics/types'
import { PhysicsError as PhysicsErrorConstructors } from '@domain/physics/types'

export interface StepOptions {
  readonly deltaTime: number
  readonly sampleBlocks: (query: AABB) => ReadonlyArray<AABB>
  readonly bodyShape: (body: RigidBody) => AABB
  readonly inputVelocity: (body: RigidBody) => RigidBody['motion']['velocity']
  readonly headBlock: (body: RigidBody) => number | null
  readonly feetBlock: (body: RigidBody) => number | null
  readonly headLevel: number
  readonly feetLevel: number
}

export interface PhysicsSimulationOrchestratorService {
  readonly createWorld: (config?: Partial<PhysicsConfig>) => Effect.Effect<PhysicsWorld, PhysicsError>
  readonly removeWorld: (worldId: PhysicsWorldId) => Effect.Effect<void, PhysicsError>
  readonly stepWorld: (
    worldId: PhysicsWorldId,
    bodies: ReadonlyArray<RigidBody>,
    options: StepOptions
  ) => Effect.Effect<
    ReadonlyArray<{
      readonly bodyId: RigidBodyId
      readonly position: AABB['min']
      readonly velocity: RigidBody['motion']['velocity']
    }>,
    PhysicsError
  >
}

export const PhysicsSimulationOrchestratorService = Context.Tag<PhysicsSimulationOrchestratorService>(
  '@minecraft/physics/PhysicsSimulationOrchestratorService'
)

export const PhysicsSimulationOrchestratorServiceLive = Layer.effect(
  PhysicsSimulationOrchestratorService,
  Effect.gen(function* () {
    const store = yield* Ref.make(new Map<PhysicsWorldId, PhysicsWorld>())
    const simulation = yield* PhysicsSimulationService

    const createWorld: PhysicsSimulationOrchestratorService['createWorld'] = (config) =>
      Effect.gen(function* () {
        const world = yield* PhysicsWorldAggregate.create({ config })
        yield* Ref.update(store, (current) => {
          const updated = new Map(current)
          updated.set(world.id, world)
          return updated
        })
        return world
      })

    const removeWorld: PhysicsSimulationOrchestratorService['removeWorld'] = (worldId) =>
      Ref.update(store, (current) => {
        const updated = new Map(current)
        updated.delete(worldId)
        return updated
      })

    const stepWorld: PhysicsSimulationOrchestratorService['stepWorld'] = (worldId, bodies, options) =>
      Effect.gen(function* () {
        const worlds = yield* Ref.get(store)
        const world = worlds.get(worldId)

        const target = yield* pipe(
          world,
          Match.value,
          Match.when(
            (value) => value === undefined,
            () =>
              Effect.fail<PhysicsWorld, PhysicsError>(
                PhysicsErrorConstructors.NotFound({ entity: 'PhysicsWorld', reference: worldId })
              )
          ),
          Match.orElse((value) => Effect.succeed(value))
        )

        const results = yield* Effect.forEach(
          bodies,
          (body) =>
            simulation.simulate({
              world: target,
              body,
              bodyShape: options.bodyShape(body),
              inputVelocity: options.inputVelocity(body),
              deltaTime: options.deltaTime,
              sampleBlocks: options.sampleBlocks,
              headBlock: options.headBlock(body),
              feetBlock: options.feetBlock(body),
              headLevel: options.headLevel,
              feetLevel: options.feetLevel,
            }),
          { concurrency: 'unbounded' }
        )

        const updatedWorld = yield* PhysicsWorldAggregate.step(target, options.deltaTime, bodies.length)

        yield* Ref.update(store, (current) => {
          const updated = new Map(current)
          updated.set(updatedWorld.id, updatedWorld)
          return updated
        })

        return Arr.zip(bodies, results).map(([body, result]) => ({
          bodyId: body.id,
          position: result.position,
          velocity: result.velocity,
        }))
      })

    return {
      createWorld,
      removeWorld,
      stepWorld,
    }
  })
)
