import { Context, Effect, Layer, pipe } from 'effect'
import type { AABB, PhysicsWorld, RigidBody, Vector3 } from '../types/core'
import { parsePositiveFloat } from '../types/core'
import { GravityVector } from '../value_object/gravity_vector'
import { FluidState } from '../value_object/fluid_state'
import { FrictionCoefficient } from '../value_object/friction_coefficient'
import { CollisionService } from './collision_service'
import type { PhysicsError } from '../types/errors'

export interface SimulationContext {
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

export interface SimulationResult {
  readonly position: Vector3
  readonly velocity: Vector3
  readonly grounded: boolean
}

export interface PhysicsSimulationService {
  readonly simulate: (context: SimulationContext) => Effect.Effect<SimulationResult, PhysicsError>
}

export const PhysicsSimulationService = Context.Tag<PhysicsSimulationService>(
  '@minecraft/physics/PhysicsSimulationService'
)

export const PhysicsSimulationServiceLive = Layer.effect(
  PhysicsSimulationService,
  Effect.gen(function* () {
    const collision = yield* CollisionService

    const simulate: PhysicsSimulationService['simulate'] = (context) =>
      Effect.gen(function* () {
        const dt = yield* parsePositiveFloat(context.deltaTime)

        const fluid = yield* FluidState.calculate({
          headBlock: context.headBlock,
          feetBlock: context.feetBlock,
          headLevel: context.headLevel,
          feetLevel: context.feetLevel,
        })

        const gravity = GravityVector.forMedium(FluidState.isInFluid(fluid))

        const velocityAfterGravity = yield* GravityVector.apply(
          GravityVector.withMultiplier(gravity, fluid.immersion),
          context.body.motion.velocity,
          dt
        )

        const velocityAfterFluid = yield* FluidState.applyResistance(fluid, velocityAfterGravity)

        const collisionResult = yield* collision.detect({
          worldId: context.world.id,
          body: context.bodyShape,
          position: context.body.motion.position,
          velocity: velocityAfterFluid,
          deltaTime: dt,
          sample: context.sampleBlocks,
        })

        const friction = FrictionCoefficient.fromMaterial(context.body.material)

        const velocityAfterFriction = yield* FrictionCoefficient.apply(
          friction,
          collisionResult.velocity,
          context.inputVelocity
        )

        const clampedVelocity = FrictionCoefficient.clampHorizontal(velocityAfterFriction, context.world.config.timeStep * 60)

        return {
          position: collisionResult.position,
          velocity: clampedVelocity,
          grounded: collisionResult.collidedAxes.y,
        }
      })

    return {
      simulate,
    }
  })
)
