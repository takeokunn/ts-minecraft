import { Context, Effect, Layer } from 'effect';
import * as THREE from 'three';
import type { BlockType } from '../runtime/game-state';

// Defines the texture paths for each face of a block.
// If a single string is provided, it's used for all faces.
const blockTexturePaths: Record<
  BlockType,
  | string
  | {
      side: string;
      top: string;
      bottom: string;
    }
> = {
  grass: {
    side: '/assets/grass/side.jpeg',
    top: '/assets/grass/top.jpeg',
    bottom: '/assets/grass/bottom.jpeg',
  },
  dirt: '/assets/dart/side.jpeg',
  stone: '/assets/cobblestone/side.jpeg',
  cobblestone: '/assets/cobblestone/side.jpeg',
  oakLog: {
    side: '/assets/oakLog/side.jpeg',
    top: '/assets/oakLog/top.jpeg',
    bottom: '/assets/oakLog/bottom.jpeg',
  },
  oakLeaves: '/assets/oakLeaves/side.jpeg',
  sand: '/assets/sand/side.jpeg',
  water: '/assets/water/side.jpeg',
  glass: '/assets/glass/side.jpeg',
  brick: '/assets/brick/side.jpeg',
  plank: '/assets/plank/side.jpeg',
};

export interface MaterialManager {
  readonly getMaterial: (
    blockType: BlockType,
  ) => THREE.MeshBasicMaterial | THREE.MeshBasicMaterial[];
}
export const MaterialManager: Context.Tag<MaterialManager, MaterialManager> =
  Context.GenericTag<MaterialManager>('@services/MaterialManager');

export const MaterialManagerLive: Layer.Layer<MaterialManager> = Layer.effect(
  MaterialManager,
  Effect.sync(() => {
    const textureLoader = new THREE.TextureLoader();
    const materialCache = new Map<
      BlockType,
      THREE.MeshBasicMaterial | THREE.MeshBasicMaterial[]
    >();

    const loadTexture = (path: string): THREE.Texture => {
      const texture = textureLoader.load(path);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      return texture;
    };

    // Pre-load all materials
    for (const key in blockTexturePaths) {
      const blockType = key as BlockType;
      const paths = blockTexturePaths[blockType];

      if (typeof paths === 'string') {
        const material = new THREE.MeshBasicMaterial({
          map: loadTexture(paths),
        });
        materialCache.set(blockType, material);
      } else {
        const materials = [
          new THREE.MeshBasicMaterial({ map: loadTexture(paths.side) }), // right
          new THREE.MeshBasicMaterial({ map: loadTexture(paths.side) }), // left
          new THREE.MeshBasicMaterial({ map: loadTexture(paths.top) }), // top
          new THREE.MeshBasicMaterial({ map: loadTexture(paths.bottom) }), // bottom
          new THREE.MeshBasicMaterial({ map: loadTexture(paths.side) }), // front
          new THREE.MeshBasicMaterial({ map: loadTexture(paths.side) }), // back
        ];
        materialCache.set(blockType, materials);
      }
    }

    const getMaterial = (
      blockType: BlockType,
    ): THREE.MeshBasicMaterial | THREE.MeshBasicMaterial[] => {
      const material = materialCache.get(blockType);
      if (!material) {
        // Return a bright pink material for missing textures to make it obvious
        return new THREE.MeshBasicMaterial({ color: 0xff00ff });
      }
      // Special handling for transparent blocks
      if (blockType === 'water' || blockType === 'glass') {
        const materials = Array.isArray(material) ? material : [material];
        materials.forEach((m) => {
          m.transparent = true;
          m.opacity = 0.7;
        });
      }
      return material;
    };

    return MaterialManager.of({ getMaterial });
  }),
);
