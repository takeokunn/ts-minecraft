import { TextureLoader, MeshBasicMaterial, type Material, SRGBColorSpace } from 'three';

export type MaterialManager = {
  get(key: string): Promise<Material>;
  dispose(): void;
};

function createTextureLoadError(path: string, originalError: unknown): Error {
  const message = `Failed to load texture: ${path}`;
  const error = new Error(message, { cause: originalError });
  error.name = 'TextureLoadError';
  return error;
}

export function createMaterialManager(): MaterialManager {
  const textureLoader = new TextureLoader();
  const materialCache = new Map<string, Material>();
  const promiseCache = new Map<string, Promise<Material>>();

  async function loadAndCreateMaterial(key: string): Promise<Material> {
    try {
      const texture = await textureLoader.loadAsync(key);
      texture.colorSpace = SRGBColorSpace;
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
    const cachedMaterial = materialCache.get(key);
    if (cachedMaterial) {
      return Promise.resolve(cachedMaterial);
    }

    const cachedPromise = promiseCache.get(key);
    if (cachedPromise) {
      return cachedPromise;
    }

    const promise = loadAndCreateMaterial(key);
    promiseCache.set(key, promise);
    return promise;
  }

  function dispose(): void {
    materialCache.forEach(material => {
      // Safely access .map property for disposal
      if (material instanceof MeshBasicMaterial && material.map) {
        material.map.dispose();
      }
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