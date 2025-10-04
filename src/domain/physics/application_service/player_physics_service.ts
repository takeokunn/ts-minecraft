import { Context, Effect, Layer } from 'effect'
import { RigidBodyAggregate } from '../aggregate/rigid_body'
import { PhysicsSimulationService } from '../domain_service/physics_simulation_service'
import type { AABB, PhysicsWorld, RigidBody, Vector3 } from '../types/core'
import type { PhysicsError } from '../types/errors'

export interface PlayerPhysicsContext {
  readonly world: PhysicsWorld
  readonly body: RigidBody
  readonly bodyShape: AABB
  readonly inputVelocity: Vector3
  readonly deltaTime: number
  readonly sampleBlocks: (query: AABB) => ReadonlyArray<AABB>
  readonly headBlock: number | null
  readonly feetBlock: number | null
  readonly headLevel: number
  readonly feetLevel: number
}

export interface PlayerPhysicsApplicationService {
  readonly step: (context: PlayerPhysicsContext) => Effect.Effect<RigidBody, PhysicsError>
}

export const PlayerPhysicsApplicationService = Context.Tag<PlayerPhysicsApplicationService>(
  '@minecraft/physics/PlayerPhysicsApplicationService'
)

export const PlayerPhysicsApplicationServiceLive = Layer.effect(
  PlayerPhysicsApplicationService,
  Effect.gen(function* () {
    const simulation = yield* PhysicsSimulationService

    const step: PlayerPhysicsApplicationService['step'] = (context) =>
      Effect.gen(function* () {
        const result = yield* simulation.simulate({
          world: context.world,
          body: context.body,
          bodyShape: context.bodyShape,
          inputVelocity: context.inputVelocity,
          deltaTime: context.deltaTime,
          sampleBlocks: context.sampleBlocks,
          headBlock: context.headBlock,
          feetBlock: context.feetBlock,
          headLevel: context.headLevel,
          feetLevel: context.feetLevel,
        })

        return yield* RigidBodyAggregate.updateMotion(context.body, result.position, result.velocity)
      })

    return {
      step,
    }
  })
)
