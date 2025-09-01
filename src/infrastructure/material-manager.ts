import { TextureLoader, MeshBasicMaterial, type Material, SRGBColorSpace } from 'three'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

// --- Error Type ---

export class TextureLoadError extends Error {
  readonly _tag = 'TextureLoadError'
  constructor(
    readonly path: string,
    readonly originalError: unknown,
  ) {
    super(`Failed to load texture: ${path}`, { cause: originalError })
    this.name = 'TextureLoadError'
  }
}

// --- Service Definition ---

export interface MaterialManager {
  readonly get: (key: string) => Effect.Effect<Material, TextureLoadError>
  readonly dispose: () => Effect.Effect<void>
}

export const MaterialManager = Context.Tag<MaterialManager>()

// --- Service Implementation ---

export const MaterialManagerLive = Layer.effect(
  MaterialManager,
  Effect.sync(() => {
    const textureLoader = new TextureLoader()
    const materialCache = new Map<string, Material>()
    const promiseCache = new Map<string, Promise<Material>>()

    async function loadAndCreateMaterial(key: string): Promise<Material> {
      try {
        const texture = await textureLoader.loadAsync(key)
        texture.colorSpace = SRGBColorSpace
        const material = new MeshBasicMaterial({ map: texture })
        materialCache.set(key, material)
        return material
      } finally {
        promiseCache.delete(key)
      }
    }

    const getAsync = (key: string): Promise<Material> => {
      const cachedMaterial = materialCache.get(key)
      if (cachedMaterial) {
        return Promise.resolve(cachedMaterial)
      }

      const cachedPromise = promiseCache.get(key)
      if (cachedPromise) {
        return cachedPromise
      }

      const promise = loadAndCreateMaterial(key)
      promiseCache.set(key, promise)
      return promise
    }

    const disposeSync = (): void => {
      materialCache.forEach((material) => {
        if (material instanceof MeshBasicMaterial && material.map) {
          material.map.dispose()
        }
        material.dispose()
      })
      materialCache.clear()
      promiseCache.clear()
    }

    return MaterialManager.of({
      get: (key) =>
        Effect.tryPromise({
          try: () => getAsync(key),
          catch: (e) => new TextureLoadError(key, e),
        }),
      dispose: () => Effect.sync(disposeSync),
    })
  }),
)
