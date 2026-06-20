import * as THREE from 'three'
import type { EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import type { MobLimbGroup } from './mob-geometry.core'
import { getOrCreateGeometry, getOrCreateMaterial } from './mob-geometry.core'
import {
  type BatPalette,
  type BatParts,
  type ChickenPalette,
  type ChickenParts,
  type QuadrupedPalette,
  type QuadrupedParts,
  type SquidPalette,
  type SquidParts,
  type ZombiePalette,
  type ZombieParts,
  BAT_PALETTE,
  BAT_PARTS,
  BEE_PALETTE,
  BEE_PARTS,
  CHICKEN_PALETTE,
  CHICKEN_PARTS,
  COW_PALETTE,
  COW_PARTS,
  CREEPER_PALETTE,
  CREEPER_PARTS,
  DRAGON_PALETTE,
  DRAGON_PARTS,
  DROWNED_PALETTE,
  DROWNED_PARTS,
  ENDERMAN_PALETTE,
  ENDERMAN_PARTS,
  ENDERMITE_PALETTE,
  ENDERMITE_PARTS,
  GLOW_SQUID_PALETTE,
  PIG_PALETTE,
  PIG_PARTS,
  SHEEP_PALETTE,
  SHEEP_PARTS,
  SKELETON_PALETTE,
  SKELETON_PARTS,
  SPIDER_PALETTE,
  SPIDER_PARTS,
  SQUID_PALETTE,
  SQUID_PARTS,
  WITCH_PALETTE,
  WITCH_PARTS,
  ZOMBIE_PALETTE,
  ZOMBIE_PARTS,
  ZOMBIE_VILLAGER_PALETTE,
  ZOMBIE_VILLAGER_PARTS,
} from './mob-geometry.parts'

const buildBiped = (typeKey: string, parts: ZombieParts, palette: ZombiePalette): MobLimbGroup => {
  const legH = parts.leg[1]
  const bodyW = parts.body[0]
  const bodyH = parts.body[1]
  const headH = parts.head[1]
  const armW = parts.arm[0]

  const root = new THREE.Group()

  const bodyGeom = getOrCreateGeometry(`${typeKey}:body`, parts.body, false)
  const bodyMat = getOrCreateMaterial(`${typeKey}:body`, palette.body)
  const body = new THREE.Mesh(bodyGeom, bodyMat)
  body.position.set(0, legH + bodyH / 2, 0)
  root.add(body)

  const headGeom = getOrCreateGeometry(`${typeKey}:head`, parts.head, false)
  const headMat = getOrCreateMaterial(`${typeKey}:head`, palette.head)
  const head = new THREE.Mesh(headGeom, headMat)
  head.position.set(0, legH + bodyH + headH / 2, 0)
  root.add(head)

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

  const bodyGeom = getOrCreateGeometry(`${typeKey}:body`, parts.body, false)
  const bodyMat = getOrCreateMaterial(`${typeKey}:body`, palette.body)
  const body = new THREE.Mesh(bodyGeom, bodyMat)
  body.position.set(0, legH + bodyH / 2, 0)
  root.add(body)

  const headGeom = getOrCreateGeometry(`${typeKey}:head`, parts.head, false)
  const headMat = getOrCreateMaterial(`${typeKey}:head`, palette.head)
  const head = new THREE.Mesh(headGeom, headMat)
  head.position.set(0, legH + bodyH - headH / 2 + 0.1, bodyD / 2 + headD / 2)
  root.add(head)

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

const buildChicken = (typeKey: string, parts: ChickenParts, palette: ChickenPalette): MobLimbGroup => {
  const [bodyW, bodyH, bodyD] = parts.body
  const [, headH, headD] = parts.head
  const [wingW] = parts.wing
  const [legW, legH] = parts.leg

  const root = new THREE.Group()

  const bodyGeom = getOrCreateGeometry(`${typeKey}:body`, parts.body, false)
  const bodyMat = getOrCreateMaterial(`${typeKey}:body`, palette.body)
  const body = new THREE.Mesh(bodyGeom, bodyMat)
  body.position.set(0, legH + bodyH / 2, 0)
  root.add(body)

  const headGeom = getOrCreateGeometry(`${typeKey}:head`, parts.head, false)
  const headMat = getOrCreateMaterial(`${typeKey}:head`, palette.head)
  const head = new THREE.Mesh(headGeom, headMat)
  head.position.set(0, legH + bodyH + headH / 2 - 0.03, bodyD / 2 + headD / 2 - 0.04)
  root.add(head)

  const wingGeom = getOrCreateGeometry(`${typeKey}:wing`, parts.wing, true)
  const wingMat = getOrCreateMaterial(`${typeKey}:wing`, palette.wing)
  const wingY = legH + bodyH * 0.85
  const wingX = bodyW / 2 + wingW / 2
  const armL = new THREE.Mesh(wingGeom, wingMat)
  armL.position.set(+wingX, wingY, 0)
  root.add(armL)
  const armR = new THREE.Mesh(wingGeom, wingMat)
  armR.position.set(-wingX, wingY, 0)
  root.add(armR)

  const legGeom = getOrCreateGeometry(`${typeKey}:leg`, parts.leg, true)
  const legMat = getOrCreateMaterial(`${typeKey}:leg`, palette.leg)
  const legX = legW * 1.1
  const legFL = new THREE.Mesh(legGeom, legMat)
  legFL.position.set(+legX, legH, 0.05)
  root.add(legFL)
  const legFR = new THREE.Mesh(legGeom, legMat)
  legFR.position.set(-legX, legH, 0.05)
  root.add(legFR)

  return { root, head, body, armL, armR, legFL, legFR, legBL: null, legBR: null }
}

const buildBat = (typeKey: string, parts: BatParts, palette: BatPalette): MobLimbGroup => {
  const [bodyW, bodyH, bodyD] = parts.body
  const [, headH, headD] = parts.head
  const [wingW] = parts.wing
  const [footW, footH] = parts.foot

  const root = new THREE.Group()

  const bodyGeom = getOrCreateGeometry(`${typeKey}:body`, parts.body, false)
  const bodyMat = getOrCreateMaterial(`${typeKey}:body`, palette.body)
  const body = new THREE.Mesh(bodyGeom, bodyMat)
  body.position.set(0, footH + bodyH / 2, 0)
  root.add(body)

  const headGeom = getOrCreateGeometry(`${typeKey}:head`, parts.head, false)
  const headMat = getOrCreateMaterial(`${typeKey}:head`, palette.head)
  const head = new THREE.Mesh(headGeom, headMat)
  head.position.set(0, footH + bodyH + headH / 2 - 0.02, bodyD / 2 + headD / 2 - 0.04)
  root.add(head)

  const wingGeom = getOrCreateGeometry(`${typeKey}:wing`, parts.wing, true)
  const wingMat = getOrCreateMaterial(`${typeKey}:wing`, palette.wing)
  const wingY = footH + bodyH * 0.85
  const wingX = bodyW / 2 + wingW / 2
  const armL = new THREE.Mesh(wingGeom, wingMat)
  armL.position.set(+wingX, wingY, 0)
  root.add(armL)
  const armR = new THREE.Mesh(wingGeom, wingMat)
  armR.position.set(-wingX, wingY, 0)
  root.add(armR)

  const footGeom = getOrCreateGeometry(`${typeKey}:foot`, parts.foot, true)
  const footMat = getOrCreateMaterial(`${typeKey}:foot`, palette.foot)
  const footX = footW
  const legFL = new THREE.Mesh(footGeom, footMat)
  legFL.position.set(+footX, footH, 0)
  root.add(legFL)
  const legFR = new THREE.Mesh(footGeom, footMat)
  legFR.position.set(-footX, footH, 0)
  root.add(legFR)

  return { root, head, body, armL, armR, legFL, legFR, legBL: null, legBR: null }
}

const buildSquid = (typeKey: string, parts: SquidParts, palette: SquidPalette): MobLimbGroup => {
  const [headW, headH, headD] = parts.head
  const [, bodyH] = parts.body
  const [tentacleW, tentacleH, tentacleD] = parts.tentacle
  const xOff = headW / 2 - tentacleW / 2
  const zOff = headD / 2 - tentacleD / 2

  const root = new THREE.Group()

  const headGeom = getOrCreateGeometry(`${typeKey}:head`, parts.head, false)
  const headMat = getOrCreateMaterial(`${typeKey}:head`, palette.head)
  const head = new THREE.Mesh(headGeom, headMat)
  head.position.set(0, tentacleH + headH / 2, 0)
  root.add(head)

  const bodyGeom = getOrCreateGeometry(`${typeKey}:body`, parts.body, false)
  const bodyMat = getOrCreateMaterial(`${typeKey}:body`, palette.body)
  const body = new THREE.Mesh(bodyGeom, bodyMat)
  body.position.set(0, tentacleH + headH + bodyH / 2, 0)
  root.add(body)

  const tentacleGeom = getOrCreateGeometry(`${typeKey}:tentacle`, parts.tentacle, true)
  const tentacleMat = getOrCreateMaterial(`${typeKey}:tentacle`, palette.tentacle)
  const legFL = new THREE.Mesh(tentacleGeom, tentacleMat)
  legFL.position.set(+xOff, tentacleH, +zOff)
  root.add(legFL)
  const legFR = new THREE.Mesh(tentacleGeom, tentacleMat)
  legFR.position.set(-xOff, tentacleH, +zOff)
  root.add(legFR)
  const legBL = new THREE.Mesh(tentacleGeom, tentacleMat)
  legBL.position.set(+xOff, tentacleH, -zOff)
  root.add(legBL)
  const legBR = new THREE.Mesh(tentacleGeom, tentacleMat)
  legBR.position.set(-xOff, tentacleH, -zOff)
  root.add(legBR)

  return { root, head, body, armL: null, armR: null, legFL, legFR, legBL, legBR }
}

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
      return buildChicken('Chicken', CHICKEN_PARTS, CHICKEN_PALETTE)
    case 'Bat':
      return buildBat('Bat', BAT_PARTS, BAT_PALETTE)
    case 'Bee':
      return buildBat('Bee', BEE_PARTS, BEE_PALETTE)
    case 'Squid':
      return buildSquid('Squid', SQUID_PARTS, SQUID_PALETTE)
    case 'GlowSquid':
      return buildSquid('GlowSquid', SQUID_PARTS, GLOW_SQUID_PALETTE)
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
    case 'Endermite':
      return buildQuadruped('Endermite', ENDERMITE_PARTS, ENDERMITE_PALETTE)
  }
}
