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
// Per-type role specs — derived from mob-geometry.ts. Kept as plain literals so
// the layout cost is paid once at module load.
// ---------------------------------------------------------------------------

// Biped layout (Zombie):
//   parts: head=[0.5,0.5,0.5], body=[0.5,0.75,0.25], arm=[0.25,0.75,0.25], leg=[0.25,0.75,0.25]
//   palette: head=0x5a8a3a, body=0x3f5e7a, arm=0x5a8a3a, leg=0x5a8a3a
const ZOMBIE_LEG_H = 0.75
const ZOMBIE_BODY_W = 0.5
const ZOMBIE_BODY_H = 0.75
const ZOMBIE_HEAD_H = 0.5
const ZOMBIE_ARM_W = 0.25

const ZOMBIE_SPECS: Readonly<Record<PartRole, Option.Option<RoleSpec>>> = {
  head: Option.some({
    size: [0.5, 0.5, 0.5],
    pivot: 'center',
    offset: { x: 0, y: ZOMBIE_LEG_H + ZOMBIE_BODY_H + ZOMBIE_HEAD_H / 2, z: 0 },
    color: 0x5a8a3a,
    swingAxis: null,
  }),
  body: Option.some({
    size: [0.5, 0.75, 0.25],
    pivot: 'center',
    offset: { x: 0, y: ZOMBIE_LEG_H + ZOMBIE_BODY_H / 2, z: 0 },
    color: 0x3f5e7a,
    swingAxis: null,
  }),
  armL: Option.some({
    size: [0.25, 0.75, 0.25],
    pivot: 'top',
    offset: { x: +(ZOMBIE_BODY_W / 2 + ZOMBIE_ARM_W / 2), y: ZOMBIE_LEG_H + ZOMBIE_BODY_H, z: 0 },
    color: 0x5a8a3a,
    swingAxis: 'x',
  }),
  armR: Option.some({
    size: [0.25, 0.75, 0.25],
    pivot: 'top',
    offset: { x: -(ZOMBIE_BODY_W / 2 + ZOMBIE_ARM_W / 2), y: ZOMBIE_LEG_H + ZOMBIE_BODY_H, z: 0 },
    color: 0x5a8a3a,
    swingAxis: 'x',
  }),
  legFL: Option.some({
    size: [0.25, 0.75, 0.25],
    pivot: 'top',
    offset: { x: +0.125, y: ZOMBIE_LEG_H, z: 0 },
    color: 0x5a8a3a,
    swingAxis: 'x',
  }),
  legFR: Option.some({
    size: [0.25, 0.75, 0.25],
    pivot: 'top',
    offset: { x: -0.125, y: ZOMBIE_LEG_H, z: 0 },
    color: 0x5a8a3a,
    swingAxis: 'x',
  }),
  legBL: Option.none(),
  legBR: Option.none(),
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

// Skeleton: biped like Zombie but thinner arms and bone-white palette.
const SKELETON_LEG_H = 0.75
const SKELETON_BODY_W = 0.5
const SKELETON_BODY_H = 0.75
const SKELETON_HEAD_H = 0.5
const SKELETON_ARM_W = 0.125

const SKELETON_SPECS: Readonly<Record<PartRole, Option.Option<RoleSpec>>> = {
  head: Option.some({
    size: [0.5, 0.5, 0.5],
    pivot: 'center',
    offset: { x: 0, y: SKELETON_LEG_H + SKELETON_BODY_H + SKELETON_HEAD_H / 2, z: 0 },
    color: 0xf0f0f0,
    swingAxis: null,
  }),
  body: Option.some({
    size: [0.5, 0.75, 0.125],
    pivot: 'center',
    offset: { x: 0, y: SKELETON_LEG_H + SKELETON_BODY_H / 2, z: 0 },
    color: 0xf0f0f0,
    swingAxis: null,
  }),
  armL: Option.some({
    size: [0.125, 0.75, 0.125],
    pivot: 'top',
    offset: { x: +(SKELETON_BODY_W / 2 + SKELETON_ARM_W / 2), y: SKELETON_LEG_H + SKELETON_BODY_H, z: 0 },
    color: 0xf0f0f0,
    swingAxis: 'x',
  }),
  armR: Option.some({
    size: [0.125, 0.75, 0.125],
    pivot: 'top',
    offset: { x: -(SKELETON_BODY_W / 2 + SKELETON_ARM_W / 2), y: SKELETON_LEG_H + SKELETON_BODY_H, z: 0 },
    color: 0xf0f0f0,
    swingAxis: 'x',
  }),
  legFL: Option.some({
    size: [0.25, 0.75, 0.25],
    pivot: 'top',
    offset: { x: +0.125, y: SKELETON_LEG_H, z: 0 },
    color: 0xf0f0f0,
    swingAxis: 'x',
  }),
  legFR: Option.some({
    size: [0.25, 0.75, 0.25],
    pivot: 'top',
    offset: { x: -0.125, y: SKELETON_LEG_H, z: 0 },
    color: 0xf0f0f0,
    swingAxis: 'x',
  }),
  legBL: Option.none(),
  legBR: Option.none(),
}

// Spider: dark low quadruped (sits close to ground), 8-legged simplified as 4.
const SPIDER_SPECS = buildQuadrupedSpecs(
  { head: [0.5, 0.375, 0.5], body: [1.5, 0.375, 0.75], leg: [0.125, 0.5, 0.125] },
  { head: 0x2a2a2a, body: 0x2a2a2a, leg: 0x2a2a2a },
)

// Enderman: extremely tall biped — 3-block-high legs, purple-eye black body.
const ENDERMAN_LEG_H = 3.0
const ENDERMAN_BODY_W = 0.375
const ENDERMAN_BODY_H = 0.875
const ENDERMAN_HEAD_H = 0.5
const ENDERMAN_ARM_W = 0.125

const ENDERMAN_SPECS: Readonly<Record<PartRole, Option.Option<RoleSpec>>> = {
  head: Option.some({
    size: [0.5, 0.5, 0.5],
    pivot: 'center',
    offset: { x: 0, y: ENDERMAN_LEG_H + ENDERMAN_BODY_H + ENDERMAN_HEAD_H / 2, z: 0 },
    color: 0x1a0d2e,
    swingAxis: null,
  }),
  body: Option.some({
    size: [0.375, 0.875, 0.25],
    pivot: 'center',
    offset: { x: 0, y: ENDERMAN_LEG_H + ENDERMAN_BODY_H / 2, z: 0 },
    color: 0x111111,
    swingAxis: null,
  }),
  armL: Option.some({
    size: [0.125, 1.5, 0.125],
    pivot: 'top',
    offset: { x: +(ENDERMAN_BODY_W / 2 + ENDERMAN_ARM_W / 2), y: ENDERMAN_LEG_H + ENDERMAN_BODY_H, z: 0 },
    color: 0x111111,
    swingAxis: 'x',
  }),
  armR: Option.some({
    size: [0.125, 1.5, 0.125],
    pivot: 'top',
    offset: { x: -(ENDERMAN_BODY_W / 2 + ENDERMAN_ARM_W / 2), y: ENDERMAN_LEG_H + ENDERMAN_BODY_H, z: 0 },
    color: 0x111111,
    swingAxis: 'x',
  }),
  legFL: Option.some({
    size: [0.125, 3.0, 0.125],
    pivot: 'top',
    offset: { x: +0.125, y: ENDERMAN_LEG_H, z: 0 },
    color: 0x111111,
    swingAxis: 'x',
  }),
  legFR: Option.some({
    size: [0.125, 3.0, 0.125],
    pivot: 'top',
    offset: { x: -0.125, y: ENDERMAN_LEG_H, z: 0 },
    color: 0x111111,
    swingAxis: 'x',
  }),
  legBL: Option.none(),
  legBR: Option.none(),
}

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
