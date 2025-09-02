import { Effect, Layer, Ref } from 'effect'
import { createGameTick } from '../loop'
import { DeltaTime, RendererService } from '../services'
import { TestClock } from '@effect/test/TestClock'
import { it } from '@effect/vitest'
import { assert, describe } from 'vitest'

// Test-specific implementation of RendererService
const makeTestRenderer = Effect.gen(function* (_) {
  const calls = {
    processRenderQueue: 0,
    syncCameraToWorld: 0,
    updateHighlight: 0,
    updateInstancedMeshes: 0,
    renderScene: 0,
  }

  const service = RendererService.of({
    processRenderQueue: Effect.sync(() => (calls.processRenderQueue += 1)),
    syncCameraToWorld: Effect.sync(() => (calls.syncCameraToWorld += 1)),
    updateHighlight: Effect.sync(() => (calls.updateHighlight += 1)),
    updateInstancedMeshes: Effect.sync(() => (calls.updateInstancedMeshes += 1)),
    renderScene: Effect.sync(() => (calls.renderScene += 1)),
  })

  return { calls, service }
})

describe('loop', () => {
  describe('createGameTick', () => {
    it('should run systems and renderer services', () =>
      Effect.gen(function* (_) {
        const { calls, service } = yield* _(makeTestRenderer)
        const TestRendererLayer = Layer.succeed(RendererService, service)

        let system1Called = false
        let system2Called = false
        const system1 = Effect.sync(() => (system1Called = true))
        const system2 = Effect.sync(() => (system2Called = true))
        const systems = [system1, system2]
        const lastTimeRef = yield* _(Ref.make(1000))

        yield* _(TestClock.setTime(2000))

        const gameTick = createGameTick(systems, lastTimeRef)
        yield* _(Effect.provide(gameTick, TestRendererLayer))

        assert.isTrue(system1Called)
        assert.isTrue(system2Called)
        assert.strictEqual(calls.processRenderQueue, 1)
        assert.strictEqual(calls.syncCameraToWorld, 1)
        assert.strictEqual(calls.updateHighlight, 1)
        assert.strictEqual(calls.updateInstancedMeshes, 1)
        assert.strictEqual(calls.renderScene, 1)
      }))

    it('should provide correct delta time to systems', () =>
      Effect.gen(function* (_) {
        const { service } = yield* _(makeTestRenderer)
        const TestRendererLayer = Layer.succeed(RendererService, service)

        const deltaTimeRef = yield* _(Ref.make(0))
        const system = Effect.flatMap(DeltaTime, (dt) => Ref.set(deltaTimeRef, dt))
        const lastTimeRef = yield* _(Ref.make(1500))

        yield* _(TestClock.setTime(2500))

        const gameTick = createGameTick([system], lastTimeRef)
        yield* _(Effect.provide(gameTick, TestRendererLayer))

        const providedDeltaTime = yield* _(Ref.get(deltaTimeRef))
        assert.strictEqual(providedDeltaTime, 1) // (2500 - 1500) / 1000
      }))

    it('should not fail with an empty list of systems', () =>
      Effect.gen(function* (_) {
        const { service } = yield* _(makeTestRenderer)
        const TestRendererLayer = Layer.succeed(RendererService, service)
        const lastTimeRef = yield* _(Ref.make(1000))
        yield* _(TestClock.setTime(2000))

        const gameTick = createGameTick([], lastTimeRef)
        yield* _(Effect.provide(gameTick, TestRendererLayer))

        // If it doesn't throw, the test passes
      }))
  })
})
