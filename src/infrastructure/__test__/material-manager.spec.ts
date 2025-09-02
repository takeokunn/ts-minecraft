import { Effect, Fiber } from 'effect'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MaterialManager, MaterialManagerLive, TextureLoadError } from '../material-manager'
import * as THREE from 'three'

// Mock Three.js
vi.mock('three', async () => {
  const actualThree = await vi.importActual('three')
  class MockMeshBasicMaterial {
    map: any
    constructor(params: { map: any }) {
      this.map = params.map
    }
    dispose() {}
  }
  return {
    ...actualThree,
    TextureLoader: vi.fn().mockImplementation(() => ({
      loadAsync: vi.fn(),
    })),
    MeshBasicMaterial: vi.fn((...args) => new (MockMeshBasicMaterial as any)(...args)),
    SRGBColorSpace: 'srgb-colorspace',
  }
})

const mockedTextureLoader = vi.mocked(THREE.TextureLoader, true)
const mockedMeshBasicMaterial = vi.mocked(THREE.MeshBasicMaterial, true)

describe('MaterialManager', () => {
  let loadAsyncMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    loadAsyncMock = vi.fn()
    mockedTextureLoader.mockImplementation(
      () =>
        ({
          loadAsync: loadAsyncMock,
        }) as any,
    )
  })

  it('should load and cache a material', async () => {
    const texture = { colorSpace: '' }
    loadAsyncMock.mockResolvedValue(texture)

    const program = Effect.gen(function* (_) {
      const manager = yield* _(MaterialManager)
      const material = yield* _(manager.get('test.png'))

      expect(material).toBeDefined()
      expect(loadAsyncMock).toHaveBeenCalledWith('test.png')
      expect(mockedMeshBasicMaterial).toHaveBeenCalledWith({ map: texture })
      expect(texture.colorSpace).toBe(THREE.SRGBColorSpace)

      // Call get again to test cache
      const cachedMaterial = yield* _(manager.get('test.png'))
      expect(cachedMaterial).toBe(material)
      expect(loadAsyncMock).toHaveBeenCalledTimes(1) // Should not be called again
    })

    await Effect.runPromise(Effect.provide(program, MaterialManagerLive))
  })

  it('should handle texture load errors', async () => {
    const error = new Error('Failed to load')
    loadAsyncMock.mockRejectedValue(error)

    const program = Effect.gen(function* (_) {
      const manager = yield* _(MaterialManager)
      const result = yield* _(Effect.flip(manager.get('error.png')))
      expect(result).toBeInstanceOf(TextureLoadError)
      expect(result.path).toBe('error.png')
      expect(result.originalError).toBe(error)
    })

    await Effect.runPromise(Effect.provide(program, MaterialManagerLive))
  })

  

  it('should handle concurrent requests for the same material', async () => {
    const texture = { colorSpace: '' }
    let resolve: (value: unknown) => void
    const promise = new Promise((r) => (resolve = r))
    loadAsyncMock.mockImplementation(() => promise)

    const program = Effect.gen(function* (_) {
      const manager = yield* _(MaterialManager)
      const fiber1 = yield* _(Effect.fork(manager.get('concurrent.png')))
      const fiber2 = yield* _(Effect.fork(manager.get('concurrent.png')))

      // Give fibers time to start
      yield* _(Effect.sleep(0))

      resolve!(texture)

      const material1 = yield* _(Fiber.join(fiber1))
      const material2 = yield* _(Fiber.join(fiber2))

      expect(material1).toBe(material2)
      expect(loadAsyncMock).toHaveBeenCalledTimes(1)
    })

    await Effect.runPromise(Effect.provide(program, MaterialManagerLive))
  })
})
