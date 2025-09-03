import { Effect, Layer, Queue } from 'effect'
import { describe, it, vi, assert } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { RendererLive } from '../'
import { Clock, MaterialManager, Renderer, RenderCommand, RenderCommandSchema } from '@/runtime/services'
import { ThreeJsContext } from '../../three-js-context'
import * as THREE from 'three'
import * as Arbitrary from 'effect/Arbitrary'

const mockScene = {
  add: vi.fn(),
  remove: vi.fn(),
}

const ThreeJsContextTest = Layer.succeed(ThreeJsContext, {
  renderer: {
    render: vi.fn(),
    setSize: vi.fn(),
    setClearColor: vi.fn(),
    domElement: document.createElement('canvas'),
  } as unknown as THREE.WebGLRenderer,
  scene: mockScene as unknown as THREE.Scene,
  camera: new THREE.PerspectiveCamera(),
})

const MaterialManagerTest = Layer.succeed(MaterialManager, {
  getMaterial: () => Effect.succeed(new THREE.MeshStandardMaterial()),
})

const ClockTest = Layer.succeed(Clock, {
  deltaTime: { get: Effect.succeed(0.016) } as any,
  onFrame: () => Effect.void,
})

const TestLayers = RendererLive.pipe(
  Layer.provide(ThreeJsContextTest),
  Layer.provide(MaterialManagerTest),
  Layer.provide(ClockTest),
)

const RenderCommandArb = Arbitrary.make(RenderCommandSchema)(fc)

describe('Renderer', () => {
  it.effect('should process render commands without crashing', () =>
    Effect.gen(function* (_) {
      yield* _(
        Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(RenderCommandArb, async (command) =>
              Effect.gen(function* (_) {
                const renderer = yield* _(Renderer)
                vi.clearAllMocks()

                yield* _(Queue.offer(renderer.renderQueue, command))
                yield* _(Effect.yieldNow()) // Allow the forked fiber to process the command

                if (command.type === 'ADD_CHUNK') {
                  assert.strictEqual(mockScene.add.mock.calls.length, 1)
                  assert.strictEqual(mockScene.remove.mock.calls.length, 0)
                } else if (command.type === 'REMOVE_CHUNK') {
                  // Note: The current implementation doesn't guarantee removal if the mesh doesn't exist.
                  // This test just ensures it doesn't crash. A more robust test would pre-populate the mesh.
                  assert.strictEqual(mockScene.add.mock.calls.length, 0)
                }
              }).pipe(Effect.provide(TestLayers), Effect.runPromise),
            ),
          ),
        ),
      )
    }))
})
