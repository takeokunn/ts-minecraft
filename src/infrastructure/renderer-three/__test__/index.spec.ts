import { Effect, Layer, Queue } from 'effect'
import { describe, it } from '@effect/vitest'
import { RendererLive } from '../'
import { Clock, MaterialManager, Renderer, RenderCommand } from '@/runtime/services'
import { ThreeJsContext } from '../../three-js-context'
import * as THREE from 'three'

const ThreeJsContextTest = Layer.succeed(
  ThreeJsContext,
  {
    renderer: {
      render: () => {},
      setSize: () => {},
      setClearColor: () => {},
      domElement: document.createElement('canvas'),
    } as unknown as THREE.WebGLRenderer,
    scene: {
      add: () => {},
      remove: () => {},
    } as unknown as THREE.Scene,
    camera: new THREE.PerspectiveCamera(),
  }
)

const MaterialManagerTest = Layer.succeed(
  MaterialManager,
  {
    getMaterial: () => Effect.succeed(new THREE.Material()),
  }
)

const ClockTest = Layer.succeed(
  Clock,
  {
    deltaTime: { get: Effect.succeed(0.016) } as any,
    onFrame: () => Effect.void,
  }
)

const TestLayers = RendererLive.pipe(
  Layer.provide(ThreeJsContextTest),
  Layer.provide(MaterialManagerTest),
  Layer.provide(ClockTest)
)

describe('Renderer', () => {
  it.effect('should process render commands', () =>
    Effect.gen(function* (_) {
      const renderer = yield* _(Renderer)
      const command: RenderCommand = {
        type: 'ADD_CHUNK',
        chunkX: 0,
        chunkZ: 0,
        positions: new Float32Array(),
        normals: new Float32Array(),
        uvs: new Float32Array(),
        indices: new Uint32Array(),
      }
      yield* _(Queue.offer(renderer.renderQueue, command))
      // Not easy to test the result without a full DOM and WebGL context
      // So we just test that it doesn't crash
    }).pipe(Effect.provide(TestLayers)))
})
