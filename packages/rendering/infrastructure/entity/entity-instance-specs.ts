import type { EntityType } from '@ts-minecraft/entity'
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
  Creeper: CREEPER_SPECS,
  Skeleton: SKELETON_SPECS,
  Spider: SPIDER_SPECS,
  Enderman: ENDERMAN_SPECS,
  EnderDragon: DRAGON_SPECS,
}

export const getRoleSpec = (type: EntityType, role: PartRole): Option.Option<RoleSpec> =>
  SPECS_BY_TYPE[type][role]

export const ROLES_BY_TYPE: Readonly<Record<EntityType, ReadonlyArray<PartRole>>> = {
  Zombie: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR'],
  Cow: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Pig: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Sheep: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Creeper: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Skeleton: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR'],
  Spider: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Enderman: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR'],
  EnderDragon: ['head', 'body'],
}
