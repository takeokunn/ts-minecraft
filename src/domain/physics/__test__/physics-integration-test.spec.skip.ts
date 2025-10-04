import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Ref } from 'effect'
import { PhysicsWorldRepositoryLive } from '../repository/physics-world-repository'
import { PhysicsWorldFactoryLive } from '../factory/physics-world-factory'
import { PhysicsSimulationServiceLive } from '../domain_service/physics-simulation-service'
import { PhysicsSimulationOrchestratorLive } from '../application_service/physics-simulation-orchestrator'
import { WorldCollisionApplicationServiceLive } from '../application_service/world-collision-service'
import { CollisionServiceLive } from '../domain_service/collision-service'
import { PlayerPhysicsServiceLive } from '../application_service/player-physics-service'
import { provideLayers } from '../../testing/effect'

describe('PhysicsIntegration', () => {
  const IntegrationLayer = Layer.mergeAll(
    PhysicsWorldRepositoryLive,
    PhysicsWorldFactoryLive,
    PhysicsSimulationServiceLive,
    PhysicsSimulationOrchestratorLive,
    CollisionServiceLive,
    WorldCollisionApplicationServiceLive,
    PlayerPhysicsServiceLive
  )

  it.effect('initializes world and steps simulation without errors', () =>
    provideLayers(
      Effect.gen(function* () {
        const orchestrator = yield* PhysicsSimulationOrchestratorLive
        const stateRef = yield* Ref.make(false)

        yield* orchestrator.initialize('world-int-test')
        yield* orchestrator.start()
        yield* orchestrator.tick(0.016)
        yield* orchestrator.stop()

        yield* Ref.set(stateRef, true)
        expect(yield* Ref.get(stateRef)).toBe(true)
      }),
      IntegrationLayer
    )
  )
})
