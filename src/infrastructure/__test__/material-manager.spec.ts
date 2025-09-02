import { Effect, Layer, Scope } from 'effect'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MaterialManager, MaterialManagerLive, TextureLoadError } from '../material-manager'
import * as THREE from 'three'

// Mock Three.js modules
vi.mock('three', async () => {
  const actualThree = await vi.importActual<typeof THREE>('three')
  class MockTexture extends actualThree.Texture {
    dispose = vi.fn()
  }
  class MockMeshBasicMaterial extends actualThree.MeshBasicMaterial {
    dispose = vi.fn()
    clone = vi.fn().mockReturnThis()
  }
  return {
    ...actualThree,
    Texture: MockTexture,
    TextureLoader: vi.fn(),
    MeshBasicMaterial: MockMeshBasicMaterial,
  }
})

const mockedTextureLoader = vi.mocked(THREE.TextureLoader)
const mockedMeshBasicMaterial = vi.mocked(THREE.MeshBasicMaterial)

describe('MaterialManager', () => {
  let loadCallback: (texture: THREE.Texture) => void
  let errorCallback: (error: ErrorEvent) => void
  let mockTexture: THREE.Texture
  let mockMaterial: THREE.MeshBasicMaterial

  beforeEach(() => {
    vi.clearAllMocks()

    mockTexture = new THREE.Texture()
    mockMaterial = new THREE.MeshBasicMaterial()

    mockedTextureLoader.mockImplementation(
      () =>
        ({
          load: vi.fn().mockImplementation((_path, onLoad, _onProgress, onError) => {
            loadCallback = onLoad
            errorCallback = onError
            return mockTexture
          }),
        }) as any,
    )
    mockedMeshBasicMaterial.mockImplementation(() => mockMaterial)
  })

  const runTest = <E, A>(effect: Effect.Effect<A, E, MaterialManager>) => {
    return Effect.runPromise(Effect.provide(effect, MaterialManagerLive))
  }

  it('should load the texture atlas and provide a material', async () => {
    const program = Effect.gen(function* (_) {
      const manager = yield* _(MaterialManager)
      // The layer build triggers the load, so we can immediately simulate completion
      loadCallback(mockTexture)
      const material = yield* _(manager.get('any_key'))

      expect(mockedTextureLoader.mock.results[0]?.value.load).toHaveBeenCalledWith(
        '/texture/texture.png',
        expect.any(Function),
        undefined,
        expect.any(Function),
      )
      expect(mockedMeshBasicMaterial).toHaveBeenCalledWith({
        map: mockTexture,
        alphaTest: 0.1,
        transparent: true,
      })
      expect(material).toBe(mockMaterial)
      expect(mockTexture.colorSpace).toBe(THREE.SRGBColorSpace)
      expect(mockTexture.magFilter).toBe(THREE.NearestFilter)
    })

    await runTest(program)
  })

  it('should return a cloned material instance on subsequent calls', async () => {
    const program = Effect.gen(function* (_) {
      const manager = yield* _(MaterialManager)
      loadCallback(mockTexture)
      const material1 = yield* _(manager.get('key1'))
      const material2 = yield* _(manager.get('key2'))

      expect(material1).toBe(mockMaterial)
      expect(material2).toBe(mockMaterial)
      expect(mockMaterial.clone).toHaveBeenCalledTimes(2)
    })

    await runTest(program)
  })

  it('should handle texture load errors', async () => {
    const error = new ErrorEvent('error', { message: 'Failed to load' })
    const program = Effect.gen(function* (_) {
      const manager = yield* _(MaterialManager)
      // Manually trigger the error after the layer starts building
      errorCallback(error)
      yield* _(manager.get('any')) // This will now fail
    })

    // We need to build the layer to run the effect inside it
    const testEffect = Effect.provide(program, MaterialManagerLive)

    await expect(Effect.runPromise(testEffect)).rejects.toThrow(
      new TextureLoadError({ path: '/texture/texture.png', originalError: error }),
    )
  })

  it('should dispose of the material when the scope is closed', async () => {
    const program = Effect.gen(function* (_) {
      const scope = yield* _(Scope.Scope)
      // Build the layer within a specific scope
      yield* _(Layer.buildWithScope(MaterialManagerLive, scope))
      loadCallback(mockTexture)

      // Now close the scope and assert that cleanup happens
      yield* _(Scope.close(scope, { exit: 'succeed' }))
      expect(mockMaterial.dispose).toHaveBeenCalledOnce()
    })

    await Effect.runPromise(program)
  })
})
