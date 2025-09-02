import { Effect } from 'effect'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MaterialManager, MaterialManagerLive, TextureLoadError } from '../material-manager'
import * as THREE from 'three'

// Mock Three.js
vi.mock('three', async () => {
  const actualThree = await vi.importActual('three')
  class MockTexture {
    colorSpace = ''
    magFilter = null
    minFilter = null
    dispose = vi.fn()
  }
  class MockMeshBasicMaterial {
    map: any
    constructor(params: { map: any }) {
      this.map = params.map
    }
    dispose = vi.fn()
  }

  return {
    ...actualThree,
    TextureLoader: vi.fn().mockImplementation(() => ({
      loadAsync: vi.fn(),
    })),
    MeshBasicMaterial: vi.fn((...args) => new (MockMeshBasicMaterial as any)(...args)),
    SRGBColorSpace: 'srgb-colorspace',
    NearestFilter: 'nearest-filter',
  }
})

const mockedTextureLoader = vi.mocked(THREE.TextureLoader, true)
const mockedMeshBasicMaterial = vi.mocked(THREE.MeshBasicMaterial, true)

describe('MaterialManager', () => {
  let loadAsyncMock: ReturnType<typeof vi.fn>
  let mockTexture: THREE.Texture
  let mockMaterial: THREE.MeshBasicMaterial

  beforeEach(() => {
    vi.clearAllMocks()

    mockTexture = new THREE.Texture()
    vi.spyOn(mockTexture, 'dispose')
    mockMaterial = new THREE.MeshBasicMaterial({ map: mockTexture })
    vi.spyOn(mockMaterial, 'dispose')

    loadAsyncMock = vi.fn().mockResolvedValue(mockTexture)
    mockedTextureLoader.mockImplementation(
      () =>
        ({
          loadAsync: loadAsyncMock,
        }) as any,
    )
    mockedMeshBasicMaterial.mockImplementation(() => mockMaterial as any)
  })

  it('should load the texture atlas and provide a material', async () => {
    const program = Effect.gen(function* (_) {
      const manager = yield* _(MaterialManager)
      const material = yield* _(manager.get('any_key_is_ignored'))

      expect(loadAsyncMock).toHaveBeenCalledWith('/texture/texture.png')
      expect(mockedMeshBasicMaterial).toHaveBeenCalledWith({ map: mockTexture })
      expect(material).toBe(mockMaterial)
      expect(mockTexture.colorSpace).toBe(THREE.SRGBColorSpace)
      expect(mockTexture.magFilter).toBe(THREE.NearestFilter)
      expect(mockTexture.minFilter).toBe(THREE.NearestFilter)
    })

    await Effect.runPromise(Effect.provide(program, MaterialManagerLive))
  })

  it('should return the same material instance on subsequent calls', async () => {
    const program = Effect.gen(function* (_) {
      const manager = yield* _(MaterialManager)
      const material1 = yield* _(manager.get('key1'))
      const material2 = yield* _(manager.get('key2'))

      expect(material1).toBe(material2)
      expect(loadAsyncMock).toHaveBeenCalledTimes(1)
    })

    await Effect.runPromise(Effect.provide(program, MaterialManagerLive))
  })

  it('should handle texture load errors', async () => {
    const error = new Error('Failed to load')
    loadAsyncMock.mockRejectedValue(error)

    const program = Effect.gen(function* (_) {
      const manager = yield* _(MaterialManager)
      // The error happens during layer creation, so we must catch the layer's error
      const result = yield* _(Effect.flip(manager.get('any')))
      return result
    })

    // We test the layer directly because the error occurs during initialization
    const layerEffect = Effect.provide(program, MaterialManagerLive)
    const result = await Effect.runPromise(Effect.flip(layerEffect))

    expect(result).toBeInstanceOf(TextureLoadError)
    expect(result.path).toBe('/texture/texture.png')
    expect(result.originalError).toBe(error)
  })

  it('should dispose of the material and texture', async () => {
    const materialDisposeSpy = vi.fn()
    const textureDisposeSpy = vi.fn()

    // Create a fresh mock implementation for this specific test
    const mockTexture = { dispose: textureDisposeSpy, colorSpace: '', magFilter: null, minFilter: null }
    const mockMaterial = { dispose: materialDisposeSpy, map: mockTexture }

    mockedTextureLoader.mockImplementation(
      () =>
        ({
          loadAsync: vi.fn().mockResolvedValue(mockTexture),
        }) as any,
    )
    mockedMeshBasicMaterial.mockImplementation(() => mockMaterial as any)

    const program = Effect.gen(function* (_) {
      const manager = yield* _(MaterialManager)
      const disposeEffect = manager.dispose()
      yield* _(disposeEffect)
    })

    await Effect.runPromise(Effect.provide(program, MaterialManagerLive))

    expect(materialDisposeSpy).toHaveBeenCalledOnce()
    expect(textureDisposeSpy).toHaveBeenCalledOnce()
  })
})
