import { Archetype } from '@/domain/archetypes'
import * as loop from '@/runtime/loop'
import {
  Clock,
  ComputationWorker,
  InputManager,
  MaterialManager,
  Raycast,
  Renderer,
  SpatialGrid,
  World,
} from '@/runtime/services'
import { Effect, Layer, Option } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { main, gameSystems } from '../main'
import * as fc from 'effect/FastCheck'
import * as EffectVitest from '@effect/vitest'

// --- Mocks ---
const worldMock = World.of({
  addArchetype: vi.fn(() => Effect.void),
  removeEntity: vi.fn(() => Effect.void),
  getComponent: vi.fn(() => Effect.succeed(Option.none())),
  updateComponent: vi.fn(() => Effect.void),
  query: vi.fn(() => Effect.succeed([])),
  querySoA: vi.fn(() => Effect.succeed({ entities: [], components: {} })),
  modify: vi.fn(() => Effect.void),
  update: vi.fn(() => Effect.void),
  getState: vi.fn(() => Effect.succeed({} as any)),
  setState: vi.fn(() => Effect.void),
  save: vi.fn(() => Effect.void),
  load: vi.fn(() => Effect.void),
  recordBlockPlacement: vi.fn(() => Effect.void),
  recordBlockDestruction: vi.fn(() => Effect.void),
})

const TestServicesLayer = Layer.succeed(World, worldMock).pipe(
  Layer.merge(Layer.succeed(Clock, Clock.of({} as any))),
  Layer.merge(Layer.succeed(InputManager, InputManager.of({} as any))),
  Layer.merge(Layer.succeed(Renderer, Renderer.of({} as any))),
  Layer.merge(Layer.succeed(MaterialManager, MaterialManager.of({} as any))),
  Layer.merge(Layer.succeed(Raycast, Raycast.of({} as any))),
  Layer.merge(
    Layer.succeed(ComputationWorker, ComputationWorker.of({} as any)),
  ),
  Layer.merge(Layer.succeed(SpatialGrid, SpatialGrid.of({} as any))),
)

describe('main', () => {
  const playerArchetype: Archetype = {
    Position: { x: 0, y: 80, z: 0 },
    Player: { isGrounded: false },
  }
  const gameLoopSpy = vi.spyOn(loop, 'gameLoop').mockReturnValue(Effect.void)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize the world and start the game loop', async () => {
    const program = main(playerArchetype).pipe(Effect.provide(TestServicesLayer))
    await Effect.runPromise(program)

    expect(worldMock.addArchetype).toHaveBeenCalledTimes(1)
    expect(worldMock.addArchetype).toHaveBeenCalledWith(playerArchetype)

    expect(gameLoopSpy).toHaveBeenCalledTimes(1)
    expect(gameLoopSpy).toHaveBeenCalledWith(gameSystems)
  })

  EffectVitest.it.effect('should always complete successfully', () =>
    Effect.gen(function* (_) {
      const program = main(playerArchetype).pipe(
        Effect.provide(TestServicesLayer),
      )

      yield* _(
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(fc.void(), async () => {
              vi.clearAllMocks()
              await Effect.runPromise(program)

              expect(worldMock.addArchetype).toHaveBeenCalledTimes(1)
              expect(gameLoopSpy).toHaveBeenCalledTimes(1)
            }),
          ),
        ),
      )
    }),
  )
})
