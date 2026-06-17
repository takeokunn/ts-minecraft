import * as THREE from 'three'
import type { EntityType } from '@ts-minecraft/entity'
import { MutableHashMap, Option } from 'effect'

export type MobLimbGroup = Readonly<{
  root: THREE.Group
  head: THREE.Mesh
  body: THREE.Mesh
  armL: THREE.Mesh | null
  armR: THREE.Mesh | null
  legFL: THREE.Mesh
  legFR: THREE.Mesh
  legBL: THREE.Mesh | null
  legBR: THREE.Mesh | null
}>

type Dim3 = readonly [number, number, number]

// Shared BoxGeometry cache keyed by `${type}:${role}`. Geometries are translated so the local origin is at the
// limb pivot (top center for limbs, geometric center for head/body). Callers MUST NOT dispose these.
const geometryCache = MutableHashMap.empty<string, THREE.BoxGeometry>()

const getOrCreateGeometry = (
  key: string,
  size: Dim3,
  pivotTop: boolean,
): THREE.BoxGeometry => {
  const cached = Option.getOrNull(MutableHashMap.get(geometryCache, key))
  if (cached !== null) return cached
  const [w, h, d] = size
  const g = new THREE.BoxGeometry(w, h, d)
  if (pivotTop) {
    // Pivot at top center: rotation around X swings the limb from the shoulder/hip.
    g.translate(0, -h / 2, 0)
  }
  MutableHashMap.set(geometryCache, key, g)
  return g
}

// Per-type material cache; shared across all mobs of the same type+role. MUST NOT be disposed by the renderer.
const materialCache = MutableHashMap.empty<string, THREE.MeshStandardMaterial>()

const getOrCreateMaterial = (key: string, color: number): THREE.MeshStandardMaterial => {
  const cached = Option.getOrNull(MutableHashMap.get(materialCache, key))
  if (cached !== null) return cached
  const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.12, roughness: 0.9, metalness: 0.0 })
  MutableHashMap.set(materialCache, key, m)
  return m
}

type ZombieParts = Readonly<{
  head: Dim3
  body: Dim3
  arm: Dim3
  leg: Dim3
}>

type QuadrupedParts = Readonly<{
  head: Dim3
  body: Dim3
  leg: Dim3
}>

type ZombiePalette = Readonly<{ head: number; body: number; arm: number; leg: number }>
type QuadrupedPalette = Readonly<{ head: number; body: number; leg: number }>

const ZOMBIE_PARTS: ZombieParts = {
  head: [0.5, 0.5, 0.5],
  body: [0.5, 0.75, 0.25],
  arm: [0.25, 0.75, 0.25],
  leg: [0.25, 0.75, 0.25],
}
const ZOMBIE_PALETTE: ZombiePalette = { head: 0x5a8a3a, body: 0x3f5e7a, arm: 0x5a8a3a, leg: 0x5a8a3a }

const COW_PARTS: QuadrupedParts = {
  head: [0.5, 0.5, 0.4],
  body: [0.625, 0.5, 1.0],
  leg: [0.25, 0.75, 0.25],
}
const COW_PALETTE: QuadrupedPalette = { head: 0x4a3020, body: 0x4a3020, leg: 0xf0f0f0 }

const PIG_PARTS: QuadrupedParts = {
  head: [0.5, 0.5, 0.5],
  body: [0.5, 0.5, 0.625],
  leg: [0.25, 0.375, 0.25],
}
const PIG_PALETTE: QuadrupedPalette = { head: 0xf0a0a0, body: 0xf0a0a0, leg: 0xf0a0a0 }

const SHEEP_PARTS: QuadrupedParts = {
  head: [0.375, 0.375, 0.5],
  body: [0.5, 0.5, 0.875],
  leg: [0.25, 0.75, 0.25],
}
const SHEEP_PALETTE: QuadrupedPalette = { head: 0xf0d8b0, body: 0xf5f5f5, leg: 0xf0d8b0 }

const CHICKEN_PARTS: QuadrupedParts = {
  head: [0.35, 0.35, 0.35],
  body: [0.45, 0.45, 0.55],
  leg: [0.08, 0.35, 0.08],
}
const CHICKEN_PALETTE: QuadrupedPalette = { head: 0xf5f5f5, body: 0xf5f5f5, leg: 0xe0a020 }

const BAT_PARTS: QuadrupedParts = {
  head: [0.3, 0.25, 0.25],
  body: [0.45, 0.22, 0.3],
  leg: [0.06, 0.14, 0.06],
}
const BAT_PALETTE: QuadrupedPalette = { head: 0x2b2420, body: 0x1f1a17, leg: 0x2b2420 }

const SQUID_PARTS: QuadrupedParts = {
  head: [0.5, 0.35, 0.5],
  body: [0.55, 0.5, 0.55],
  leg: [0.08, 0.55, 0.08],
}
const SQUID_PALETTE: QuadrupedPalette = { head: 0x315f8f, body: 0x2f78b7, leg: 0x1f4f7a }

const WITCH_PARTS: ZombieParts = {
  head: [0.5, 0.55, 0.5],
  body: [0.5, 0.75, 0.25],
  arm: [0.18, 0.75, 0.18],
  leg: [0.25, 0.75, 0.25],
}
const WITCH_PALETTE: ZombiePalette = { head: 0x6b8f4e, body: 0x4b2a63, arm: 0x3a214f, leg: 0x2a1a36 }

const DROWNED_PARTS: ZombieParts = {
  head: [0.5, 0.5, 0.5],
  body: [0.5, 0.75, 0.25],
  arm: [0.25, 0.75, 0.25],
  leg: [0.25, 0.75, 0.25],
}
const DROWNED_PALETTE: ZombiePalette = { head: 0x3f8f83, body: 0x274f68, arm: 0x2f7f77, leg: 0x1f4f5f }

const ZOMBIE_VILLAGER_PARTS: ZombieParts = {
  head: [0.55, 0.55, 0.55],
  body: [0.5, 0.75, 0.25],
  arm: [0.25, 0.75, 0.25],
  leg: [0.25, 0.75, 0.25],
}
const ZOMBIE_VILLAGER_PALETTE: ZombiePalette = { head: 0x6f9b4c, body: 0x6b4a2f, arm: 0x6f9b4c, leg: 0x3f4f7a }

const buildBiped = (
  typeKey: string,
  parts: ZombieParts,
  palette: ZombiePalette,
): MobLimbGroup => {
  const legH = parts.leg[1]
  const bodyW = parts.body[0]
  const bodyH = parts.body[1]
  const headH = parts.head[1]
  const armW = parts.arm[0]

  const root = new THREE.Group()

  // Body: pivot at geometric center; sits on top of legs.
  const bodyGeom = getOrCreateGeometry(`${typeKey}:body`, parts.body, false)
  const bodyMat = getOrCreateMaterial(`${typeKey}:body`, palette.body)
  const body = new THREE.Mesh(bodyGeom, bodyMat)
  body.position.set(0, legH + bodyH / 2, 0)
  root.add(body)

  // Head: sits on top of body, geometric center.
  const headGeom = getOrCreateGeometry(`${typeKey}:head`, parts.head, false)
  const headMat = getOrCreateMaterial(`${typeKey}:head`, palette.head)
  const head = new THREE.Mesh(headGeom, headMat)
  head.position.set(0, legH + bodyH + headH / 2, 0)
  root.add(head)

  // Arms: pivot at top (shoulder), hang down. Positioned at body sides.
  const armGeom = getOrCreateGeometry(`${typeKey}:arm`, parts.arm, true)
  const armMat = getOrCreateMaterial(`${typeKey}:arm`, palette.arm)
  const armX = bodyW / 2 + armW / 2
  const shoulderY = legH + bodyH
  const armL = new THREE.Mesh(armGeom, armMat)
  armL.position.set(+armX, shoulderY, 0)
  root.add(armL)
  const armR = new THREE.Mesh(armGeom, armMat)
  armR.position.set(-armX, shoulderY, 0)
  root.add(armR)

  // Legs: pivot at top (hip), hang down to the ground. Hips at y = legH.
  const legGeom = getOrCreateGeometry(`${typeKey}:leg`, parts.leg, true)
  const legMat = getOrCreateMaterial(`${typeKey}:leg`, palette.leg)
  const legX = parts.leg[0] / 2
  const legFL = new THREE.Mesh(legGeom, legMat)
  legFL.position.set(+legX, legH, 0)
  root.add(legFL)
  const legFR = new THREE.Mesh(legGeom, legMat)
  legFR.position.set(-legX, legH, 0)
  root.add(legFR)

  return { root, head, body, armL, armR, legFL, legFR, legBL: null, legBR: null }
}

const buildQuadruped = (
  typeKey: string,
  parts: QuadrupedParts,
  palette: QuadrupedPalette,
): MobLimbGroup => {
  const [bodyW, bodyH, bodyD] = parts.body
  const [, headH, headD] = parts.head
  const [legW, legH, legD] = parts.leg

  const root = new THREE.Group()

  // Body: horizontal box, sits atop legs.
  const bodyGeom = getOrCreateGeometry(`${typeKey}:body`, parts.body, false)
  const bodyMat = getOrCreateMaterial(`${typeKey}:body`, palette.body)
  const body = new THREE.Mesh(bodyGeom, bodyMat)
  body.position.set(0, legH + bodyH / 2, 0)
  root.add(body)

  // Head: pokes out of body front (+z), centered vertically near body top.
  const headGeom = getOrCreateGeometry(`${typeKey}:head`, parts.head, false)
  const headMat = getOrCreateMaterial(`${typeKey}:head`, palette.head)
  const head = new THREE.Mesh(headGeom, headMat)
  head.position.set(0, legH + bodyH - headH / 2 + 0.1, bodyD / 2 + headD / 2)
  root.add(head)

  // Legs at 4 corners: pivot at top (hip), under body. F = +z, B = -z, L = +x, R = -x.
  const legGeom = getOrCreateGeometry(`${typeKey}:leg`, parts.leg, true)
  const legMat = getOrCreateMaterial(`${typeKey}:leg`, palette.leg)
  const xOff = bodyW / 2 - legW / 2
  const zOff = bodyD / 2 - legD / 2
  const hipY = legH

  const legFL = new THREE.Mesh(legGeom, legMat)
  legFL.position.set(+xOff, hipY, +zOff)
  root.add(legFL)
  const legFR = new THREE.Mesh(legGeom, legMat)
  legFR.position.set(-xOff, hipY, +zOff)
  root.add(legFR)
  const legBL = new THREE.Mesh(legGeom, legMat)
  legBL.position.set(+xOff, hipY, -zOff)
  root.add(legBL)
  const legBR = new THREE.Mesh(legGeom, legMat)
  legBR.position.set(-xOff, hipY, -zOff)
  root.add(legBR)

  return { root, head, body, armL: null, armR: null, legFL, legFR, legBL, legBR }
}

const CREEPER_PARTS: QuadrupedParts = {
  head: [0.5, 0.5, 0.5],
  body: [0.5, 0.75, 0.375],
  leg: [0.25, 0.5, 0.25],
}
const CREEPER_PALETTE: QuadrupedPalette = { head: 0x2d5c1e, body: 0x2d5c1e, leg: 0x2d5c1e }

const SKELETON_PARTS: ZombieParts = {
  head: [0.5, 0.5, 0.5],
  body: [0.5, 0.75, 0.125],
  arm: [0.125, 0.75, 0.125],
  leg: [0.25, 0.75, 0.25],
}
const SKELETON_PALETTE: ZombiePalette = { head: 0xf0f0f0, body: 0xf0f0f0, arm: 0xf0f0f0, leg: 0xf0f0f0 }

const SPIDER_PARTS: QuadrupedParts = {
  head: [0.5, 0.375, 0.5],
  body: [1.5, 0.375, 0.75],
  leg: [0.125, 0.5, 0.125],
}
const SPIDER_PALETTE: QuadrupedPalette = { head: 0x2a2a2a, body: 0x2a2a2a, leg: 0x2a2a2a }

const ENDERMAN_PARTS: ZombieParts = {
  head: [0.5, 0.5, 0.5],
  body: [0.375, 0.875, 0.25],
  arm: [0.125, 1.5, 0.125],
  leg: [0.125, 3.0, 0.125],
}
const ENDERMAN_PALETTE: ZombiePalette = { head: 0x1a0d2e, body: 0x111111, arm: 0x111111, leg: 0x111111 }

const DRAGON_PARTS: ZombieParts = {
  head: [1.0, 0.75, 1.5],
  body: [1.25, 1.0, 3.0],
  arm: [0.25, 0.75, 0.25],
  leg: [0.25, 0.5, 0.25],
}
const DRAGON_PALETTE: ZombiePalette = { head: 0x0a0020, body: 0x0a0020, arm: 0x0a0020, leg: 0x0a0020 }

export const buildMobGroup = (type: EntityType): MobLimbGroup => {
  switch (type) {
    case 'Zombie':
      return buildBiped('Zombie', ZOMBIE_PARTS, ZOMBIE_PALETTE)
    case 'Cow':
      return buildQuadruped('Cow', COW_PARTS, COW_PALETTE)
    case 'Pig':
      return buildQuadruped('Pig', PIG_PARTS, PIG_PALETTE)
    case 'Sheep':
      return buildQuadruped('Sheep', SHEEP_PARTS, SHEEP_PALETTE)
    case 'Chicken':
      return buildQuadruped('Chicken', CHICKEN_PARTS, CHICKEN_PALETTE)
    case 'Bat':
      return buildQuadruped('Bat', BAT_PARTS, BAT_PALETTE)
    case 'Squid':
      return buildQuadruped('Squid', SQUID_PARTS, SQUID_PALETTE)
    case 'Witch':
      return buildBiped('Witch', WITCH_PARTS, WITCH_PALETTE)
    case 'Drowned':
      return buildBiped('Drowned', DROWNED_PARTS, DROWNED_PALETTE)
    case 'ZombieVillager':
      return buildBiped('ZombieVillager', ZOMBIE_VILLAGER_PARTS, ZOMBIE_VILLAGER_PALETTE)
    case 'Creeper':
      return buildQuadruped('Creeper', CREEPER_PARTS, CREEPER_PALETTE)
    case 'Skeleton':
      return buildBiped('Skeleton', SKELETON_PARTS, SKELETON_PALETTE)
    case 'Spider':
      return buildQuadruped('Spider', SPIDER_PARTS, SPIDER_PALETTE)
    case 'Enderman':
      return buildBiped('Enderman', ENDERMAN_PARTS, ENDERMAN_PALETTE)
    case 'EnderDragon':
      return buildBiped('EnderDragon', DRAGON_PARTS, DRAGON_PALETTE)
  }
}
