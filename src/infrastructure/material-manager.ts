import { Layer, Effect } from 'effect';
import * as THREE from 'three';
import { MaterialManager } from '../runtime/services';

// This is the live implementation of the MaterialManager service.
// It manages a single material that uses a texture atlas for all blocks.
export const MaterialManagerLive: Layer.Layer<MaterialManager> = Layer.effect(
  MaterialManager,
  Effect.sync(() => {
    const textureLoader = new THREE.TextureLoader();

    // Load the texture atlas
    // IMPORTANT: Create a `texture-atlas.png` file in the `public/assets/` directory.
    const atlasTexture = textureLoader.load('/assets/texture-atlas.png');
    atlasTexture.magFilter = THREE.NearestFilter;
    atlasTexture.minFilter = THREE.NearestFilter;

    const material = new THREE.MeshStandardMaterial({
      map: atlasTexture,
      side: THREE.FrontSide,
      // alphaTest is used to discard fragments with an alpha value below a certain threshold.
      // This is useful for textures with transparent parts like glass or leaves.
      alphaTest: 0.1,
      transparent: true,
    });

    // The `get` method returns the single, shared material for the atlas.
    const get = () => Effect.succeed(material);

    return MaterialManager.of({ get });
  }),
);
