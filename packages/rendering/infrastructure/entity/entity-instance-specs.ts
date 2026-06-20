import type { EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import { Option } from 'effect'

// Roles align with MobLimbGroup fields. We store a per-(type, role) bucket
// because mob types have different geometry sizes per role (e.g. zombie head
// = 0.5×0.5×0.5 vs cow head = 0.5×0.5×0.4) so geometry cannot be shared
// across types within a single InstancedMesh.
export type PartRole = 'head' | 'body' | 'armL' | 'armR' | 'legFL' | 'legFR' | 'legBL' | 'legBR'

// Geometry pivot policy mirrors mob-geometry.ts:
//   - head/body: geometric center pivot
//   - arm/leg: TOP-CENTER pivot (so rotation.x swings from the shoulder/hip)
export type Dim3 = readonly [number, number, number]
export type RolePivot = 'center' | 'top'

export type RoleSpec = Readonly<{
  size: Dim3
  pivot: RolePivot
  // Local offset from mob root to the part pivot. Combined with per-mob world
  // transform to produce the InstancedMesh matrix.
  offset: { readonly x: number; readonly y: number; readonly z: number }
  color: number
  // Optional: which axis carries the swing angle (currently always 'x'). Kept
  // explicit so future limb-types could rotate around y/z without code change.
  swingAxis: 'x' | null
}>

// ---------------------------------------------------------------------------
// Per-type role specs — derived from mob-geometry.ts. Built via factory helpers
// at module load; cost is paid once.
// ---------------------------------------------------------------------------

// Biped layout helper (head + body + 2 arms + 2 front legs; back legs absent).
const buildBipedSpecs = (
  parts: { head: Dim3; body: Dim3; arm: Dim3; leg: Dim3; legXOff?: number },
  palette: { head: number; body: number; arm: number; leg: number },
): Readonly<Record<PartRole, Option.Option<RoleSpec>>> => {
  const [bodyW, bodyH] = parts.body
  const [, headH] = parts.head
  const [armW] = parts.arm
  const [legW, legH] = parts.leg
  const legXOff = parts.legXOff ?? legW / 2
  return {
    head: Option.some({ size: parts.head, pivot: 'center', offset: { x: 0, y: legH + bodyH + headH / 2, z: 0 }, color: palette.head, swingAxis: null }),
    body: Option.some({ size: parts.body, pivot: 'center', offset: { x: 0, y: legH + bodyH / 2, z: 0 }, color: palette.body, swingAxis: null }),
    armL: Option.some({ size: parts.arm, pivot: 'top', offset: { x: +(bodyW / 2 + armW / 2), y: legH + bodyH, z: 0 }, color: palette.arm, swingAxis: 'x' }),
    armR: Option.some({ size: parts.arm, pivot: 'top', offset: { x: -(bodyW / 2 + armW / 2), y: legH + bodyH, z: 0 }, color: palette.arm, swingAxis: 'x' }),
    legFL: Option.some({ size: parts.leg, pivot: 'top', offset: { x: +legXOff, y: legH, z: 0 }, color: palette.leg, swingAxis: 'x' }),
    legFR: Option.some({ size: parts.leg, pivot: 'top', offset: { x: -legXOff, y: legH, z: 0 }, color: palette.leg, swingAxis: 'x' }),
    legBL: Option.none(),
    legBR: Option.none(),
  }
}

// Quadruped layout helper.
const buildQuadrupedSpecs = (
  parts: { head: Dim3; body: Dim3; leg: Dim3 },
  palette: { head: number; body: number; leg: number },
): Readonly<Record<PartRole, Option.Option<RoleSpec>>> => {
  const [bodyW, bodyH, bodyD] = parts.body
  const [, headH, headD] = parts.head
  const [legW, legH, legD] = parts.leg
  const xOff = bodyW / 2 - legW / 2
  const zOff = bodyD / 2 - legD / 2
  const hipY = legH

  return {
    head: Option.some({
      size: parts.head,
      pivot: 'center',
      offset: { x: 0, y: legH + bodyH - headH / 2 + 0.1, z: bodyD / 2 + headD / 2 },
      color: palette.head,
      swingAxis: null,
    }),
    body: Option.some({
      size: parts.body,
      pivot: 'center',
      offset: { x: 0, y: legH + bodyH / 2, z: 0 },
      color: palette.body,
      swingAxis: null,
    }),
    armL: Option.none(),
    armR: Option.none(),
    legFL: Option.some({
      size: parts.leg, pivot: 'top',
      offset: { x: +xOff, y: hipY, z: +zOff }, color: palette.leg, swingAxis: 'x',
    }),
    legFR: Option.some({
      size: parts.leg, pivot: 'top',
      offset: { x: -xOff, y: hipY, z: +zOff }, color: palette.leg, swingAxis: 'x',
    }),
    legBL: Option.some({
      size: parts.leg, pivot: 'top',
      offset: { x: +xOff, y: hipY, z: -zOff }, color: palette.leg, swingAxis: 'x',
    }),
    legBR: Option.some({
      size: parts.leg, pivot: 'top',
      offset: { x: -xOff, y: hipY, z: -zOff }, color: palette.leg, swingAxis: 'x',
    }),
  }
}

const buildChickenSpecs = (
  parts: { head: Dim3; body: Dim3; wing: Dim3; leg: Dim3 },
  palette: { head: number; body: number; wing: number; leg: number },
): Readonly<Record<PartRole, Option.Option<RoleSpec>>> => {
  const [bodyW, bodyH, bodyD] = parts.body
  const [, headH, headD] = parts.head
  const [wingW] = parts.wing
  const [legW, legH] = parts.leg
  return {
    head: Option.some({
      size: parts.head,
      pivot: 'center',
      offset: { x: 0, y: legH + bodyH + headH / 2 - 0.03, z: bodyD / 2 + headD / 2 - 0.04 },
      color: palette.head,
      swingAxis: null,
    }),
    body: Option.some({ size: parts.body, pivot: 'center', offset: { x: 0, y: legH + bodyH / 2, z: 0 }, color: palette.body, swingAxis: null }),
    armL: Option.some({ size: parts.wing, pivot: 'top', offset: { x: +(bodyW / 2 + wingW / 2), y: legH + bodyH * 0.85, z: 0 }, color: palette.wing, swingAxis: 'x' }),
    armR: Option.some({ size: parts.wing, pivot: 'top', offset: { x: -(bodyW / 2 + wingW / 2), y: legH + bodyH * 0.85, z: 0 }, color: palette.wing, swingAxis: 'x' }),
    legFL: Option.some({ size: parts.leg, pivot: 'top', offset: { x: +(legW * 1.1), y: legH, z: 0.05 }, color: palette.leg, swingAxis: 'x' }),
    legFR: Option.some({ size: parts.leg, pivot: 'top', offset: { x: -(legW * 1.1), y: legH, z: 0.05 }, color: palette.leg, swingAxis: 'x' }),
    legBL: Option.none(),
    legBR: Option.none(),
  }
}

const buildBatSpecs = (
  parts: { head: Dim3; body: Dim3; wing: Dim3; foot: Dim3 },
  palette: { head: number; body: number; wing: number; foot: number },
): Readonly<Record<PartRole, Option.Option<RoleSpec>>> => {
  const [bodyW, bodyH, bodyD] = parts.body
  const [, headH, headD] = parts.head
  const [wingW] = parts.wing
  const [footW, footH] = parts.foot
  return {
    head: Option.some({
      size: parts.head,
      pivot: 'center',
      offset: { x: 0, y: footH + bodyH + headH / 2 - 0.02, z: bodyD / 2 + headD / 2 - 0.04 },
      color: palette.head,
      swingAxis: null,
    }),
    body: Option.some({ size: parts.body, pivot: 'center', offset: { x: 0, y: footH + bodyH / 2, z: 0 }, color: palette.body, swingAxis: null }),
    armL: Option.some({ size: parts.wing, pivot: 'top', offset: { x: +(bodyW / 2 + wingW / 2), y: footH + bodyH * 0.85, z: 0 }, color: palette.wing, swingAxis: 'x' }),
    armR: Option.some({ size: parts.wing, pivot: 'top', offset: { x: -(bodyW / 2 + wingW / 2), y: footH + bodyH * 0.85, z: 0 }, color: palette.wing, swingAxis: 'x' }),
    legFL: Option.some({ size: parts.foot, pivot: 'top', offset: { x: +footW, y: footH, z: 0 }, color: palette.foot, swingAxis: 'x' }),
    legFR: Option.some({ size: parts.foot, pivot: 'top', offset: { x: -footW, y: footH, z: 0 }, color: palette.foot, swingAxis: 'x' }),
    legBL: Option.none(),
    legBR: Option.none(),
  }
}

const buildSquidSpecs = (
  parts: { head: Dim3; body: Dim3; tentacle: Dim3 },
  palette: { head: number; body: number; tentacle: number },
): Readonly<Record<PartRole, Option.Option<RoleSpec>>> => {
  const [headW, headH, headD] = parts.head
  const [, bodyH] = parts.body
  const [tentacleW, tentacleH, tentacleD] = parts.tentacle
  const xOff = headW / 2 - tentacleW / 2
  const zOff = headD / 2 - tentacleD / 2
  return {
    head: Option.some({ size: parts.head, pivot: 'center', offset: { x: 0, y: tentacleH + headH / 2, z: 0 }, color: palette.head, swingAxis: null }),
    body: Option.some({ size: parts.body, pivot: 'center', offset: { x: 0, y: tentacleH + headH + bodyH / 2, z: 0 }, color: palette.body, swingAxis: null }),
    armL: Option.none(),
    armR: Option.none(),
    legFL: Option.some({ size: parts.tentacle, pivot: 'top', offset: { x: +xOff, y: tentacleH, z: +zOff }, color: palette.tentacle, swingAxis: 'x' }),
    legFR: Option.some({ size: parts.tentacle, pivot: 'top', offset: { x: -xOff, y: tentacleH, z: +zOff }, color: palette.tentacle, swingAxis: 'x' }),
    legBL: Option.some({ size: parts.tentacle, pivot: 'top', offset: { x: +xOff, y: tentacleH, z: -zOff }, color: palette.tentacle, swingAxis: 'x' }),
    legBR: Option.some({ size: parts.tentacle, pivot: 'top', offset: { x: -xOff, y: tentacleH, z: -zOff }, color: palette.tentacle, swingAxis: 'x' }),
  }
}

const COW_SPECS = buildQuadrupedSpecs(
  { head: [0.5, 0.5, 0.4], body: [0.625, 0.5, 1.0], leg: [0.25, 0.75, 0.25] },
  { head: 0x4a3020, body: 0x4a3020, leg: 0xf0f0f0 },
)
const PIG_SPECS = buildQuadrupedSpecs(
  { head: [0.5, 0.5, 0.5], body: [0.5, 0.5, 0.625], leg: [0.25, 0.375, 0.25] },
  { head: 0xf0a0a0, body: 0xf0a0a0, leg: 0xf0a0a0 },
)
const SHEEP_SPECS = buildQuadrupedSpecs(
  { head: [0.375, 0.375, 0.5], body: [0.5, 0.5, 0.875], leg: [0.25, 0.75, 0.25] },
  { head: 0xf0d8b0, body: 0xf5f5f5, leg: 0xf0d8b0 },
)
const CHICKEN_SPECS = buildChickenSpecs(
  { head: [0.32, 0.32, 0.32], body: [0.45, 0.48, 0.5], wing: [0.08, 0.28, 0.28], leg: [0.08, 0.35, 0.08] },
  { head: 0xf5f5f5, body: 0xf5f5f5, wing: 0xf5f5f5, leg: 0xe0a020 },
)

const BAT_SPECS = buildBatSpecs(
  { head: [0.3, 0.25, 0.25], body: [0.45, 0.22, 0.3], wing: [0.55, 0.05, 0.28], foot: [0.06, 0.12, 0.06] },
  { head: 0x2b2420, body: 0x1f1a17, wing: 0x15110f, foot: 0x2b2420 },
)

const BEE_SPECS = buildBatSpecs(
  { head: [0.28, 0.24, 0.24], body: [0.55, 0.32, 0.42], wing: [0.65, 0.04, 0.3], foot: [0.07, 0.1, 0.07] },
  { head: 0x1f1b13, body: 0xe4b83f, wing: 0xb9e6ff, foot: 0x1f1b13 },
)

const SQUID_SPECS = buildSquidSpecs(
  { head: [0.5, 0.35, 0.5], body: [0.55, 0.5, 0.55], tentacle: [0.08, 0.55, 0.08] },
  { head: 0x315f8f, body: 0x2f78b7, tentacle: 0x1f4f7a },
)
const GLOW_SQUID_SPECS = buildSquidSpecs(
  { head: [0.5, 0.35, 0.5], body: [0.55, 0.5, 0.55], tentacle: [0.08, 0.55, 0.08] },
  { head: 0x37d6c8, body: 0x5df0df, tentacle: 0x1db8aa },
)

const WITCH_SPECS = buildBipedSpecs(
  { head: [0.42, 0.55, 0.42], body: [0.56, 1.05, 0.32], arm: [0.18, 0.95, 0.18], leg: [0.18, 0.45, 0.18] },
  { head: 0x6b8f4e, body: 0x4b2a63, arm: 0x3a214f, leg: 0x2a1a36 },
)

const DROWNED_SPECS = buildBipedSpecs(
  { head: [0.52, 0.5, 0.52], body: [0.52, 0.78, 0.28], arm: [0.2, 0.8, 0.2], leg: [0.22, 0.72, 0.22] },
  { head: 0x4fa89a, body: 0x1f5f72, arm: 0x3b8f80, leg: 0x1b4d5f },
)

const ZOMBIE_VILLAGER_SPECS = buildBipedSpecs(
  { head: [0.62, 0.58, 0.62], body: [0.58, 0.9, 0.32], arm: [0.22, 0.85, 0.22], leg: [0.22, 0.6, 0.22] },
  { head: 0x7fa85a, body: 0x7a4f2a, arm: 0x6f9b4c, leg: 0x2f3f5f },
)

// Creeper: quadruped (4 stubby legs), no arms, dark-green all over.
const CREEPER_SPECS = buildQuadrupedSpecs(
  { head: [0.5, 0.5, 0.5], body: [0.5, 0.75, 0.375], leg: [0.25, 0.5, 0.25] },
  { head: 0x2d5c1e, body: 0x2d5c1e, leg: 0x2d5c1e },
)

const ZOMBIE_SPECS = buildBipedSpecs(
  { head: [0.5, 0.5, 0.5], body: [0.5, 0.75, 0.25], arm: [0.25, 0.75, 0.25], leg: [0.25, 0.75, 0.25] },
  { head: 0x5a8a3a, body: 0x3f5e7a, arm: 0x5a8a3a, leg: 0x5a8a3a },
)

// Skeleton: biped like Zombie but thinner arms and bone-white palette.
const SKELETON_SPECS = buildBipedSpecs(
  { head: [0.5, 0.5, 0.5], body: [0.5, 0.75, 0.125], arm: [0.125, 0.75, 0.125], leg: [0.25, 0.75, 0.25] },
  { head: 0xf0f0f0, body: 0xf0f0f0, arm: 0xf0f0f0, leg: 0xf0f0f0 },
)

// Spider: dark low quadruped (sits close to ground), 8-legged simplified as 4.
const SPIDER_SPECS = buildQuadrupedSpecs(
  { head: [0.5, 0.375, 0.5], body: [1.5, 0.375, 0.75], leg: [0.125, 0.5, 0.125] },
  { head: 0x2a2a2a, body: 0x2a2a2a, leg: 0x2a2a2a },
)

const ENDERMITE_SPECS = buildQuadrupedSpecs(
  { head: [0.24, 0.18, 0.24], body: [0.48, 0.18, 0.64], leg: [0.06, 0.18, 0.06] },
  { head: 0xb7b3a5, body: 0x8c887c, leg: 0x5f5b54 },
)

// Enderman: extremely tall biped — 3-block-high legs, legXOff wider than legW/2 gives natural stride.
const ENDERMAN_SPECS = buildBipedSpecs(
  { head: [0.5, 0.5, 0.5], body: [0.375, 0.875, 0.25], arm: [0.125, 1.5, 0.125], leg: [0.125, 3.0, 0.125], legXOff: 0.125 },
  { head: 0x1a0d2e, body: 0x111111, arm: 0x111111, leg: 0x111111 },
)

// EnderDragon — boss entity; body + head only, no limbs. Dark purple palette.
const DRAGON_SPECS: Readonly<Record<PartRole, Option.Option<RoleSpec>>> = {
  head: Option.some({
    size: [1.0, 0.75, 1.5],
    pivot: 'center',
    offset: { x: 0, y: 1.5, z: -1.25 },
    color: 0x0a0020,
    swingAxis: null,
  }),
  body: Option.some({
    size: [1.25, 1.0, 3.0],
    pivot: 'center',
    offset: { x: 0, y: 0.25, z: 0 },
    color: 0x0a0020,
    swingAxis: null,
  }),
  armL: Option.none(),
  armR: Option.none(),
  legFL: Option.none(),
  legFR: Option.none(),
  legBL: Option.none(),
  legBR: Option.none(),
}

const SPECS_BY_TYPE: Readonly<Record<EntityType, Readonly<Record<PartRole, Option.Option<RoleSpec>>>>> = {
  Zombie: ZOMBIE_SPECS,
  Cow: COW_SPECS,
  Pig: PIG_SPECS,
  Sheep: SHEEP_SPECS,
  Chicken: CHICKEN_SPECS,
  Bat: BAT_SPECS,
  Bee: BEE_SPECS,
  Squid: SQUID_SPECS,
  GlowSquid: GLOW_SQUID_SPECS,
  Witch: WITCH_SPECS,
  Drowned: DROWNED_SPECS,
  ZombieVillager: ZOMBIE_VILLAGER_SPECS,
  Creeper: CREEPER_SPECS,
  Skeleton: SKELETON_SPECS,
  Spider: SPIDER_SPECS,
  Enderman: ENDERMAN_SPECS,
  EnderDragon: DRAGON_SPECS,
  Endermite: ENDERMITE_SPECS,
}

export const getRoleSpec = (type: EntityType, role: PartRole): Option.Option<RoleSpec> =>
  SPECS_BY_TYPE[type][role]

export const ROLES_BY_TYPE: Readonly<Record<EntityType, ReadonlyArray<PartRole>>> = {
  Zombie: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR'],
  Cow: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Pig: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Sheep: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Chicken: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR'],
  Bat: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR'],
  Bee: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR'],
  Squid: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  GlowSquid: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Witch: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR'],
  Drowned: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR'],
  ZombieVillager: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR'],
  Creeper: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Skeleton: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR'],
  Spider: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Enderman: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR'],
  EnderDragon: ['head', 'body'],
  Endermite: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
}
