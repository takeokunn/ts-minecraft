import { Effect, Schema } from 'effect'
import * as THREE from 'three'
import { Sky } from 'three/addons/objects/Sky.js'
import { SceneService } from '@ts-minecraft/rendering'
import { StartupError } from '@ts-minecraft/game'
import { resolvePreset } from '@ts-minecraft/game'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/core'
import { MAX_SHADOW_HALF_EXTENT, SkyMaterialPortSchema } from '@ts-minecraft/core'
import {
  SUN_COLOR, AMBIENT_COLOR, SKY_COLOR_NIGHT, SKY_COLOR_DAY,
} from '@ts-minecraft/app/main.config'

export const buildLighting = (
  scene: THREE.Scene,
  sceneService: SceneService,
  initialSettings: { renderDistance: number },
  initialGraphics: ReturnType<typeof resolvePreset>,
) => Effect.gen(function* () {
  const light = yield* Effect.sync(() => {
    const l = new THREE.DirectionalLight(SUN_COLOR, 1)
    // Shadow map resolution + PCF soft-shadow radius are preset-scaled (the "影Mod" lever):
    // low/medium 1024–2048, high 3072, ultra 4096 with a wider soft penumbra.
    l.shadow.mapSize.width = initialGraphics.shadowMapSize
    l.shadow.mapSize.height = initialGraphics.shadowMapSize
    l.shadow.radius = initialGraphics.shadowRadius
    l.shadow.camera.near = 0.5
    l.shadow.camera.far = Math.max(initialSettings.renderDistance * CHUNK_SIZE * 1.5 + CHUNK_HEIGHT, 300)
    const shadowHalfExtent = Math.min(Math.ceil(initialSettings.renderDistance * CHUNK_SIZE * 0.5), MAX_SHADOW_HALF_EXTENT)
    l.shadow.camera.left = -shadowHalfExtent
    l.shadow.camera.right = shadowHalfExtent
    l.shadow.camera.top = shadowHalfExtent
    l.shadow.camera.bottom = -shadowHalfExtent
    l.shadow.bias = -0.0005
    l.shadow.normalBias = 0.6
    l.position.set(5, 10, 7)
    l.castShadow = initialGraphics.shadowsEnabled
    return l
  })
  yield* sceneService.add(scene, light)
  yield* sceneService.add(scene, light.target)

  const ambientLight = yield* Effect.sync(() => new THREE.AmbientLight(AMBIENT_COLOR, 0.35))
  yield* sceneService.add(scene, ambientLight)

  const sky = yield* Effect.sync(() => {
    const s = new Sky()
    s.scale.setScalar(10000)
    return s
  })
  yield* sceneService.add(scene, sky)
  const skyShaderMaterial = yield* Effect.gen(function* () {
    const skyMaterial = Array.isArray(sky.material) ? sky.material[0] : sky.material
    if (!(skyMaterial instanceof THREE.ShaderMaterial)) {
      return yield* Effect.fail(new StartupError({ reason: 'Sky material is not a ShaderMaterial' }))
    }
    const mat = skyMaterial
    if (mat.uniforms['mieCoefficient'] != null) mat.uniforms['mieCoefficient'].value = 0.005
    if (mat.uniforms['mieDirectionalG'] != null) mat.uniforms['mieDirectionalG'].value = 0.7
    return mat
  })
  const skyPort = yield* Schema.decodeUnknown(SkyMaterialPortSchema)({
    uniforms: {
      sunPosition: skyShaderMaterial.uniforms['sunPosition'],
      turbidity: skyShaderMaterial.uniforms['turbidity'],
      rayleigh: skyShaderMaterial.uniforms['rayleigh'],
    },
  })

  const { skyNight, skyDay, skyCurrent } = yield* Effect.sync(() => ({
    skyNight: new THREE.Color(SKY_COLOR_NIGHT),
    skyDay: new THREE.Color(SKY_COLOR_DAY),
    skyCurrent: new THREE.Color(),
  }))

  // Atmospheric distance fog. Without it the world read as flat cardboard: a hard
  // chunk boundary against an untextured sky and no aerial perspective. Linear fog
  // fades terrain into the horizon just inside the visible (render-distance) ring,
  // which both hides chunk pop-in and gives depth. Crucially we point fog.color at
  // the SAME skyCurrent Color instance the day/night cycle mutates in place every
  // frame (lerpColors), so the fog tracks the sky from noon-blue to night-black for
  // free — no per-frame plumbing, no port change. MeshLambertMaterial (chunk + water
  // meshes) honours scene.fog by default; the terrain shader injection only touches
  // the map/color chunks, leaving the fog chunks intact.
  yield* Effect.sync(() => {
    const visible = initialSettings.renderDistance * CHUNK_SIZE
    scene.fog = new THREE.Fog(skyCurrent.getHex(), visible * 0.55, visible * 1.08)
    scene.fog.color = skyCurrent // share the reference so it tracks the day/night sky
  })

  return { light, ambientLight, sky, skyPort, skyNight, skyDay, skyCurrent }
})
