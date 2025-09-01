import { TextureLoader, MeshBasicMaterial, type Material, SRGBColorSpace } from 'three';
import { match } from 'ts-pattern';

export type MaterialManager = {
  get(key: string): Promise<Material>;
  dispose(): void;
};

function createTextureLoadError(path: string, originalError: unknown): Error {
  const message =
    originalError instanceof Error
      ? `Failed to load texture: ${path}, Error: ${originalError.message}`
      : `Failed to load texture: ${path}, Error: ${String(originalError)}`;
  const error = new Error(message);
  error.name = 'TextureLoadError';
  if (originalError instanceof Error) {
    error.stack = originalError.stack;
  }
  return error;
}

export function createMaterialManager(): MaterialManager {
  const textureLoader = new TextureLoader();
  const materialCache = new Map<string, Material>();
  const promiseCache = new Map<string, Promise<Material>>();

  async function loadAndCreateMaterial(key: string): Promise<Material> {
    try {
      const texture = await textureLoader.loadAsync(key);
      if (texture) {
        texture.colorSpace = SRGBColorSpace;
      }
      const material = new MeshBasicMaterial({ map: texture });
      materialCache.set(key, material);
      promiseCache.delete(key);
      return material;
    } catch (e) {
      promiseCache.delete(key);
      throw createTextureLoadError(key, e);
    }
  }

  function get(key: string): Promise<Material> {
    return match(materialCache.get(key))
      .when(
        material => material !== undefined,
        material => Promise.resolve(material!),
      )
      .otherwise(() => {
        const cachedPromise = promiseCache.get(key);
        if (cachedPromise) {
          return cachedPromise;
        }

        const promise = loadAndCreateMaterial(key);
        promiseCache.set(key, promise);
        return promise;
      });
  }

  function dispose(): void {
    materialCache.forEach(material => {
      (material as MeshBasicMaterial).map?.dispose();
      material.dispose();
    });
    materialCache.clear();
    promiseCache.clear();
  }

  return {
    get,
    dispose,
  };
}