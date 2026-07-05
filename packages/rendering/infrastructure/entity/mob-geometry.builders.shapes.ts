import * as THREE from 'three'
import type { MobLimbGroup } from './mob-geometry.core'
import { getOrCreateGeometry, getOrCreateMaterial } from './mob-geometry.core'
import type {
  BatPalette,
  BatParts,
  BlazePalette,
  BlazeParts,
  ChickenPalette,
  ChickenParts,
  QuadrupedPalette,
  QuadrupedParts,
  ShulkerPalette,
  ShulkerParts,
  SquidPalette,
  SquidParts,
  ZombiePalette,
  ZombieParts,
} from './mob-geometry.parts'

// Pure body-plan builders: each maps a set of part dimensions + palette to a
// MobLimbGroup. They are dispatched by mob type in mob-geometry.builders.ts —
// this module holds only the "how to assemble each body shape" geometry, kept
// separate so the shape catalogue and the mob→shape routing stay small.

export const buildBiped = (typeKey: string, parts: ZombieParts, palette: ZombiePalette): MobLimbGroup => {
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

export const buildQuadruped = (
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

export const buildChicken = (typeKey: string, parts: ChickenParts, palette: ChickenPalette): MobLimbGroup => {
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

export const buildBat = (typeKey: string, parts: BatParts, palette: BatPalette): MobLimbGroup => {
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

export const buildSquid = (typeKey: string, parts: SquidParts, palette: SquidPalette): MobLimbGroup => {
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

export const buildShulker = (typeKey: string, parts: ShulkerParts, palette: ShulkerPalette): MobLimbGroup => {
  const [bodyW, bodyH] = parts.body
  const [, headH] = parts.head
  const [shellW] = parts.shellSide
  const root = new THREE.Group()

  const bodyGeom = getOrCreateGeometry(`${typeKey}:body`, parts.body, false)
  const bodyMat = getOrCreateMaterial(`${typeKey}:body`, palette.body)
  const body = new THREE.Mesh(bodyGeom, bodyMat)
  body.position.set(0, bodyH / 2, 0)
  root.add(body)

  const headGeom = getOrCreateGeometry(`${typeKey}:head`, parts.head, false)
  const headMat = getOrCreateMaterial(`${typeKey}:head`, palette.head)
  const head = new THREE.Mesh(headGeom, headMat)
  head.position.set(0, bodyH + headH / 2 - 0.08, 0)
  root.add(head)

  const shellGeom = getOrCreateGeometry(`${typeKey}:shellSide`, parts.shellSide, true)
  const shellMat = getOrCreateMaterial(`${typeKey}:shellSide`, palette.shell)
  const shellX = bodyW / 2 + shellW / 2
  const shellY = bodyH
  const legFL = new THREE.Mesh(shellGeom, shellMat)
  legFL.position.set(+shellX, shellY, 0)
  root.add(legFL)
  const legFR = new THREE.Mesh(shellGeom, shellMat)
  legFR.position.set(-shellX, shellY, 0)
  root.add(legFR)

  return {
    root,
    head,
    body,
    armL: null,
    armR: null,
    legFL,
    legFR,
    legBL: null,
    legBR: null,
  }
}

export const buildBlaze = (typeKey: string, parts: BlazeParts, palette: BlazePalette): MobLimbGroup => {
  const [, headH] = parts.head
  const [, coreH] = parts.core
  const [rodW, rodH] = parts.rod

  const root = new THREE.Group()

  // Molten core floating at mid-height with the head cube above it.
  const coreGeom = getOrCreateGeometry(`${typeKey}:core`, parts.core, false)
  const coreMat = getOrCreateMaterial(`${typeKey}:core`, palette.core)
  const body = new THREE.Mesh(coreGeom, coreMat)
  const coreY = rodH + coreH / 2
  body.position.set(0, coreY, 0)
  root.add(body)

  const headGeom = getOrCreateGeometry(`${typeKey}:head`, parts.head, false)
  const headMat = getOrCreateMaterial(`${typeKey}:head`, palette.head)
  const head = new THREE.Mesh(headGeom, headMat)
  head.position.set(0, coreY + coreH / 2 + headH / 2, 0)
  root.add(head)

  // Six floating rods around the core: four in the leg slots, two in the arm
  // slots, so the walk cycle swings them like orbiting embers.
  const rodGeom = getOrCreateGeometry(`${typeKey}:rod`, parts.rod, true)
  const rodMat = getOrCreateMaterial(`${typeKey}:rod`, palette.rod)
  const rodRadius = 0.32
  const legY = rodH
  const legFL = new THREE.Mesh(rodGeom, rodMat)
  legFL.position.set(+rodRadius, legY, +rodRadius)
  root.add(legFL)
  const legFR = new THREE.Mesh(rodGeom, rodMat)
  legFR.position.set(-rodRadius, legY, +rodRadius)
  root.add(legFR)
  const legBL = new THREE.Mesh(rodGeom, rodMat)
  legBL.position.set(+rodRadius, legY, -rodRadius)
  root.add(legBL)
  const legBR = new THREE.Mesh(rodGeom, rodMat)
  legBR.position.set(-rodRadius, legY, -rodRadius)
  root.add(legBR)

  const armY = rodH + coreH
  const armX = rodRadius + rodW
  const armL = new THREE.Mesh(rodGeom, rodMat)
  armL.position.set(+armX, armY, 0)
  root.add(armL)
  const armR = new THREE.Mesh(rodGeom, rodMat)
  armR.position.set(-armX, armY, 0)
  root.add(armR)

  return { root, head, body, armL, armR, legFL, legFR, legBL, legBR }
}
