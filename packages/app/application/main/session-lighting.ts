import { Effect, Schema } from 'effect'
import * as THREE from 'three'
import { Sky } from 'three/addons/objects/Sky.js'
import { SceneService } from '@ts-minecraft/rendering'
import { StartupError } from '@ts-minecraft/game'
import { resolvePreset } from '@ts-minecraft/game/application/settings-service.config'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/core'
import { MAX_SHADOW_HALF_EXTENT, MoonPhasePortSchema, SkyMaterialPortSchema } from '@ts-minecraft/core'
import {
  SUN_COLOR, AMBIENT_COLOR, SKY_COLOR_NIGHT, SKY_COLOR_DAY,
} from '@ts-minecraft/app/main.config'

const MOON_TEXTURE_SIZE = 64
const MOON_VISUAL_SCALE = 180

const createMoonPhaseTexture = (phase: number): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas')
  canvas.width = MOON_TEXTURE_SIZE
  canvas.height = MOON_TEXTURE_SIZE
  const ctx = canvas.getContext('2d')

  if (ctx !== null) {
    const center = MOON_TEXTURE_SIZE / 2
    const radius = MOON_TEXTURE_SIZE * 0.38
    const phaseIndex = ((Math.trunc(phase) % 8) + 8) % 8
    const illumination = phaseIndex <= 4 ? 1 - phaseIndex / 4 : (phaseIndex - 4) / 4
    const waxing = phaseIndex > 4

    ctx.clearRect(0, 0, MOON_TEXTURE_SIZE, MOON_TEXTURE_SIZE)
    ctx.fillStyle = 'rgba(16, 20, 32, 0.72)'
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(226, 232, 218, 0.96)'
    for (let y = 0; y < MOON_TEXTURE_SIZE; y++) {
      for (let x = 0; x < MOON_TEXTURE_SIZE; x++) {
        const nx = (x + 0.5 - center) / radius
        const ny = (y + 0.5 - center) / radius
        if (nx * nx + ny * ny > 1) continue

        let lit = false
        if (phaseIndex === 0) {
          lit = true
        } else if (phaseIndex === 4) {
          lit = false
        } else if (waxing) {
          lit = nx >= 1 - 2 * illumination
        } else {
          lit = nx <= -(1 - 2 * illumination)
        }
        if (lit) ctx.fillRect(x, y, 1, 1)
      }
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

const createMoonPhaseTextures = (): ReadonlyArray<THREE.CanvasTexture> =>
  Array.from({ length: 8 }, (_unused, phase) => createMoonPhaseTexture(phase))

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

  const { moonSprite, moonPort } = yield* Effect.gen(function* () {
    const moonTextures = createMoonPhaseTextures()
    const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonTextures[0],
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }))
    moonSprite.scale.set(MOON_VISUAL_SCALE, MOON_VISUAL_SCALE, 1)
    moonSprite.renderOrder = 10
    moonSprite.visible = false
    const material = moonSprite.material
    const moonPort = yield* Schema.decodeUnknown(MoonPhasePortSchema)({
      setPosition: (x: number, y: number, z: number) => {
        moonSprite.position.set(x, y, z)
      },
      setPhase: (phase: number) => {
        const normalized = ((Math.trunc(phase) % moonTextures.length) + moonTextures.length) % moonTextures.length
        material.map = moonTextures[normalized] ?? moonTextures[0] ?? null
        material.needsUpdate = true
      },
      setVisible: (visible: boolean) => {
        moonSprite.visible = visible
      },
      setOpacity: (opacity: number) => {
        material.opacity = Math.max(0, Math.min(1, opacity))
      },
    })
    return { moonSprite, moonPort }
  })
  yield* sceneService.add(scene, moonSprite)

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

  return { light, ambientLight, sky, skyPort, skyNight, skyDay, skyCurrent, moonPort }
})
