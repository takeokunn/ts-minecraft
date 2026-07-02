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

const buildArmMesh = (): THREE.Mesh => {
  // Skin-tone arm with a darker sleeve cap, mirroring the classic skin.
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.16, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xd0a080 }),
  )
  arm.name = 'first-person-hand-arm'
  const sleeve = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, 0.18),
    new THREE.MeshLambertMaterial({ color: 0x3f7f3f }),
  )
  sleeve.name = 'first-person-hand-sleeve'
  sleeve.position.z = 0.2
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
