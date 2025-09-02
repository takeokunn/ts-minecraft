import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Ref from 'effect/Ref'
import { createGameTick } from '../loop'
import { DeltaTime, RendererService } from '../services'
import { WorldLive } from '../world'

// Mock RendererService
const mockRenderer = {
  processRenderQueue: Effect.void,
  syncCameraToWorld: Effect.void,
  updateHighlight: Effect.void,
  updateInstancedMeshes: Effect.void,
  renderScene: Effect.void,
}

const MockRendererLive = Layer.succeed(RendererService, mockRenderer)

describe('gameLoop', () => {
  beforeEach(() => {
    vi.spyOn(performance, 'now')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('gameTick should run systems and provide delta time', async () => {
    const ref = await Effect.runPromise(Ref.make(0))
    const system1 = Ref.update(ref, (n) => n + 1)
    const system2 = Effect.gen(function* (_) {
      const dt = yield* _(DeltaTime)
      expect(dt).toBe(0.01)
      yield* _(Ref.update(ref, (n) => n * 2))
    })

    const systems = [system1, system2]

    const program = Effect.gen(function* (_) {
      const lastTimeRef = yield* _(Ref.make(0))
      vi.mocked(performance.now).mockReturnValue(10) // 10ms elapsed
      const gameTick = createGameTick(systems, lastTimeRef)
      yield* _(gameTick)
    })

    const testEffect = Effect.provide(program, Layer.merge(WorldLive, MockRendererLive))
    await Effect.runPromise(testEffect)

    const finalValue = await Effect.runPromise(Ref.get(ref))
    expect(finalValue).toBe(2) // 0 -> 1 -> 2
  })
})
