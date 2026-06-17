// @effect-boundary Three.js shader hooks may fail at adapter boundaries; failures remain infrastructure-local.
import { Effect, type Scope } from 'effect'
import * as THREE from 'three'
import { TextureError } from '../../domain/errors'
import { ATLAS_COLS, ATLAS_SIZE, HALF_TEXEL } from '../textures/block-texture-map'

export const buildAtlasTexture = (): Effect.Effect<THREE.Texture, TextureError> =>
  Effect.async<THREE.Texture, TextureError>((resume) => {
    const canvas = document.createElement('canvas')
    canvas.width = ATLAS_SIZE
    canvas.height = ATLAS_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      resume(Effect.fail(new TextureError({ url: '/textures/atlas.png', cause: new Error('Failed to acquire 2D canvas context') })))
      return
    }
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0)
      const texture = new THREE.CanvasTexture(canvas)
      texture.magFilter = THREE.NearestFilter
      texture.minFilter = THREE.NearestMipmapNearestFilter
      texture.generateMipmaps = true
      texture.anisotropy = 8
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      texture.colorSpace = THREE.SRGBColorSpace
      resume(Effect.succeed(texture))
    }
    img.onerror = (e) => {
      resume(Effect.fail(new TextureError({ url: '/textures/atlas.png', cause: e instanceof Error ? e : new Error(String(e)) })))
    }
    img.src = '/textures/atlas.png'
    return Effect.sync(() => {
      img.onload = null
      img.onerror = null
    })
  })

export type ChunkMeshMaterials = {
  readonly sharedMaterial: THREE.MeshLambertMaterial
  readonly transparentSolidMaterial: THREE.MeshLambertMaterial
  readonly setSunIntensity: (value: number) => void
}

export const createChunkMeshMaterials = (atlasTexture: THREE.Texture): Effect.Effect<ChunkMeshMaterials, never, Scope.Scope> =>
  Effect.gen(function* () {
    // Per-vertex colors encode three light factors normalized to [0,1] in the shader:
    //   R = ambient occlusion (1 = unoccluded, 0 = fully occluded)
    //   G = sky-light factor   (skyLight / 15)
    //   B = block-light factor (blockLight / 15)
    //
    // The patch below replaces Three.js' vertex-color contribution to combine sky and block
    // light (so torchlight at night is bright like vanilla) and modulate the result by AO.
    // uSunIntensity is exposed per-material (default 1.0 = full daylight); a future
    // time-of-day system can ramp this between 0 and 1 for diurnal cycles.
    const sharedUniforms = { uSunIntensity: { value: 1.0 } }
    const sharedMaterial = yield* Effect.acquireRelease(
      Effect.sync(() => {
        const mat = new THREE.MeshLambertMaterial({
          color: 0xffffff,
          emissive: 0xffffff,
          emissiveIntensity: 0.02,
          map: atlasTexture,
          vertexColors: true,
        })
        mat.onBeforeCompile = (shader) => {
          shader.uniforms['uSunIntensity'] = sharedUniforms.uSunIntensity
          shader.uniforms['uAtlasCols'] = { value: ATLAS_COLS }
          shader.uniforms['uAtlasHalfTexel'] = { value: HALF_TEXEL }
          // Inject lighting compute into the fragment shader. We replace the standard
          // <color_fragment> chunk (which would multiply diffuseColor by vColor as a tint)
          // with our own combine: sky*sun + block (max-blended), then modulated by AO.
          // The shader's vColor varying carries (R=AO, G=sky, B=block) in [0,1] from the
          // BufferAttribute's `normalized: true` flag.
          // Guard against Three.js upgrade silently breaking smooth-lighting injection.
          if (
            !shader.vertexShader.includes('void main() {')
            || !shader.fragmentShader.includes('void main() {')
            || !shader.fragmentShader.includes('#include <map_fragment>')
            || !shader.fragmentShader.includes('#include <color_fragment>')
          ) {
            throw new Error('chunk-mesh: Three.js shader tokens for atlas/lighting injection not found — terrain shader injection will silently no-op')
          }
          shader.vertexShader = shader.vertexShader
            .replace(
              'void main() {',
              `attribute float tileIndex;\nvarying float vAtlasTileIndex;\nvoid main() {\n  vAtlasTileIndex = tileIndex;`
            )
          shader.fragmentShader = shader.fragmentShader
            .replace(
              'void main() {',
              `uniform float uSunIntensity;\nuniform float uAtlasCols;\nuniform float uAtlasHalfTexel;\nvarying float vAtlasTileIndex;\nvoid main() {`
            )
            .replace(
              '#include <map_fragment>',
              `#ifdef USE_MAP
                float atlasIndex = floor(vAtlasTileIndex + 0.5);
                float atlasCol = mod(atlasIndex, uAtlasCols);
                float atlasRow = floor(atlasIndex / uAtlasCols);
                vec2 tileUv = fract(vMapUv);
                vec2 atlasMin = vec2(
                  atlasCol / uAtlasCols + uAtlasHalfTexel,
                  1.0 - (atlasRow + 1.0) / uAtlasCols + uAtlasHalfTexel
                );
                vec2 atlasMax = vec2(
                  (atlasCol + 1.0) / uAtlasCols - uAtlasHalfTexel,
                  1.0 - atlasRow / uAtlasCols - uAtlasHalfTexel
                );
                vec4 sampledDiffuseColor = texture2D(map, mix(atlasMin, atlasMax, tileUv));
                #ifdef DECODE_VIDEO_TEXTURE
                  sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
                #endif
                diffuseColor *= sampledDiffuseColor;
              #endif`
            )
            .replace(
              '#include <color_fragment>',
              `#ifdef USE_COLOR
                 float aoFactor = vColor.r;
                 float skyFactor = vColor.g;
                 float blockFactor = vColor.b;
                 float lightFactor = max(skyFactor * uSunIntensity, blockFactor);
                  diffuseColor.rgb *= (0.45 + 0.55 * lightFactor) * (0.8 + 0.2 * aoFactor);
               #endif`
            )
        }
        // Three.js caches compiled programs by material UUID + defines; ensure recompile
        // by setting needsUpdate after assignment.
        mat.needsUpdate = true
        return mat
      }),
      (mat) => Effect.sync(() => mat.dispose())
    )
    
    // Transparent-solid material: atlas texture alpha + depth-write off.
    // Shared across all GLASS/LEAVES chunks — same atlas, so atlas-UVs and tileIndex work identically.
    // Keep material opacity at 1 so opaque leaves texels stay solid; glass/ice translucency comes from PNG alpha.
    // alphaTest:0.1 cuts out fully-transparent atlas texels for plant silhouettes.
    // depthWrite:false prevents z-fighting with overlapping faces.
    const transparentSolidMaterial = yield* Effect.acquireRelease(
      Effect.sync(() => {
        const mat = new THREE.MeshLambertMaterial({
          color: 0xffffff,
          emissive: 0xffffff,
          emissiveIntensity: 0.02,
          map: atlasTexture,
          vertexColors: true,
          transparent: true,
          opacity: 1,
          alphaTest: 0.1,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
        mat.onBeforeCompile = (shader) => {
          shader.uniforms['uSunIntensity'] = sharedUniforms.uSunIntensity
          shader.uniforms['uAtlasCols'] = { value: ATLAS_COLS }
          shader.uniforms['uAtlasHalfTexel'] = { value: HALF_TEXEL }
          if (
            !shader.vertexShader.includes('void main() {')
            || !shader.fragmentShader.includes('void main() {')
            || !shader.fragmentShader.includes('#include <map_fragment>')
            || !shader.fragmentShader.includes('#include <color_fragment>')
          ) {
            throw new Error('chunk-mesh: Three.js shader tokens for atlas/lighting injection not found — transparent solid shader injection will silently no-op')
          }
          shader.vertexShader = shader.vertexShader
            .replace(
              'void main() {',
              `attribute float tileIndex;\nvarying float vAtlasTileIndex;\nvoid main() {\n  vAtlasTileIndex = tileIndex;`
            )
          shader.fragmentShader = shader.fragmentShader
            .replace(
              'void main() {',
              `uniform float uSunIntensity;\nuniform float uAtlasCols;\nuniform float uAtlasHalfTexel;\nvarying float vAtlasTileIndex;\nvoid main() {`
            )
            .replace(
              '#include <map_fragment>',
              `#ifdef USE_MAP
                float atlasIndex = floor(vAtlasTileIndex + 0.5);
                float atlasCol = mod(atlasIndex, uAtlasCols);
                float atlasRow = floor(atlasIndex / uAtlasCols);
                vec2 tileUv = fract(vMapUv);
                vec2 atlasMin = vec2(
                  atlasCol / uAtlasCols + uAtlasHalfTexel,
                  1.0 - (atlasRow + 1.0) / uAtlasCols + uAtlasHalfTexel
                );
                vec2 atlasMax = vec2(
                  (atlasCol + 1.0) / uAtlasCols - uAtlasHalfTexel,
                  1.0 - atlasRow / uAtlasCols - uAtlasHalfTexel
                );
                vec4 sampledDiffuseColor = texture2D(map, mix(atlasMin, atlasMax, tileUv));
                #ifdef DECODE_VIDEO_TEXTURE
                  sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
                #endif
                diffuseColor *= sampledDiffuseColor;
              #endif`
            )
            .replace(
              '#include <color_fragment>',
              `#ifdef USE_COLOR
                 float aoFactor = vColor.r;
                 float skyFactor = vColor.g;
                 float blockFactor = vColor.b;
                 float lightFactor = max(skyFactor * uSunIntensity, blockFactor);
                  diffuseColor.rgb *= (0.45 + 0.55 * lightFactor) * (0.8 + 0.2 * aoFactor);
               #endif`
            )
        }
        mat.needsUpdate = true
        return mat
      }),
      (mat) => Effect.sync(() => mat.dispose())
    )

    return {
      sharedMaterial,
      transparentSolidMaterial,
      setSunIntensity: (value: number): void => {
        sharedUniforms.uSunIntensity.value = Math.max(0, Math.min(1, value))
      },
    }
  })
