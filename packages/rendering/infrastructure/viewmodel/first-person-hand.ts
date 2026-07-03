import * as THREE from 'three'

// First-person viewmodel: a blocky arm (vanilla Steve-style box) anchored to
// the camera's bottom-right, driven by the existing attack-swing state. The
// camera swing (render-stage translate/roll) moves the whole view; this adds
// the visible arm chop on top of it.

const HAND_GROUP_NAME = 'first-person-hand'

// Camera-local rest pose (right-handed: +x right, -z forward).
const REST_POSITION = { x: 0.38, y: -0.34, z: -0.55 } as const
const REST_ROTATION = { x: 0.35, y: -0.55, z: 0.1 } as const
// Swing arc: forward chop around X plus a slight inward yaw.
const SWING_PITCH_RADS = -1.1
const SWING_YAW_RADS = 0.35
const SWING_FORWARD_UNITS = 0.12

// Deterministic per-pixel hash (no Math.random — keeps the skin identical
// across sessions and testable).
const pixelHash = (x: number, y: number): number => {
  let h = (x * 374761393 + y * 668265263) >>> 0
  h = (h ^ (h >>> 13)) >>> 0
  h = (h * 1274126177) >>> 0
  return ((h >>> 16) & 0xff) / 255
}

// 8×8 pixel-noise texture around a base color — the classic Minecraft-skin
// dither that keeps a flat-colored box from reading as an untextured quad.
// Returns null outside the browser (unit tests run in node); callers fall
// back to a plain color material.
const makePixelSkinTexture = (r: number, g: number, b: number): THREE.CanvasTexture | null => {
  // Guard both node (no document) and tests that stub a partial document.
  /* c8 ignore next */
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null
  const SIZE = 8
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (ctx === null) return null
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const shade = 0.9 + pixelHash(x, y) * 0.18
      ctx.fillStyle = `rgb(${Math.min(255, Math.round(r * shade))}, ${Math.min(255, Math.round(g * shade))}, ${Math.min(255, Math.round(b * shade))})`
      ctx.fillRect(x, y, 1, 1)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const makeSkinMaterial = (color: number): THREE.MeshLambertMaterial => {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  const texture = makePixelSkinTexture(r, g, b)
  return texture === null
    ? new THREE.MeshLambertMaterial({ color })
    : new THREE.MeshLambertMaterial({ map: texture })
}

// Steve palette: tanned skin + teal shirt sleeve.
const SKIN_COLOR = 0xc68e63
const SLEEVE_COLOR = 0x2e8b8b

const buildArmMesh = (): THREE.Mesh => {
  // Skin-tone forearm; the teal sleeve covers the upper (camera-near) half
  // like the classic Steve shirt, instead of the old thin cap.
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.16, 0.5),
    makeSkinMaterial(SKIN_COLOR),
  )
  arm.name = 'first-person-hand-arm'
  const sleeve = new THREE.Mesh(
    new THREE.BoxGeometry(0.185, 0.185, 0.26),
    makeSkinMaterial(SLEEVE_COLOR),
  )
  sleeve.name = 'first-person-hand-sleeve'
  sleeve.position.z = 0.15
  arm.add(sleeve)
  return arm
}

/**
 * Attaches the viewmodel to the camera exactly once and returns it. The camera
 * must itself live in the scene for its children to render — Three.js only
 * traverses scene-graph descendants — so the first call adds it when missing.
 */
export const ensureFirstPersonHand = (
  camera: THREE.Camera,
  scene: THREE.Scene,
): THREE.Group => {
  const existing = camera.getObjectByName(HAND_GROUP_NAME)
  if (existing instanceof THREE.Group) return existing

  const group = new THREE.Group()
  group.name = HAND_GROUP_NAME
  group.position.set(REST_POSITION.x, REST_POSITION.y, REST_POSITION.z)
  group.rotation.set(REST_ROTATION.x, REST_ROTATION.y, REST_ROTATION.z)
  group.add(buildArmMesh())
  camera.add(group)
  if (camera.parent === null) scene.add(camera)
  return group
}

/**
 * Poses the arm for the current swing frame. `swingAmount` is the render
 * stage's attack-swing X offset (0 at rest, peaking mid-swing) — the same
 * signal that drives the camera bob, so arm and camera stay in phase.
 */
export const updateFirstPersonHandSwing = (hand: THREE.Group, swingAmount: number): void => {
  hand.rotation.x = REST_ROTATION.x + swingAmount * SWING_PITCH_RADS
  hand.rotation.y = REST_ROTATION.y + swingAmount * SWING_YAW_RADS
  hand.rotation.z = REST_ROTATION.z
  hand.position.z = REST_POSITION.z - swingAmount * SWING_FORWARD_UNITS
}
