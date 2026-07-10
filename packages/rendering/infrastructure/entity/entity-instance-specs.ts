import type { EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import { Option } from 'effect'
import type { PartRole, RoleSpec } from './entity-instance-specs.types'
import {
  buildBatSpecs,
  buildBipedSpecs,
  buildChickenSpecs,
  buildQuadrupedSpecs,
  buildSquidSpecs,
} from './entity-instance-specs.builders'

// Re-export the role/spec vocabulary so existing consumers keep importing it
// from this module (the public spec surface).
export type { Dim3, PartRole, RolePivot, RoleSpec } from './entity-instance-specs.types'

// ---------------------------------------------------------------------------
// Per-type role specs — derived from mob-geometry.ts, built via the factory
// helpers (entity-instance-specs.builders.ts) at module load; cost paid once.
// ---------------------------------------------------------------------------

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

// Ghast: a large pale cube with dangling tentacles — the squid frame scaled
// up with the vanilla off-white palette and gray under-tentacles.
const GHAST_SPECS = buildSquidSpecs(
  { head: [1.1, 0.5, 1.1], body: [1.3, 1.3, 1.3], tentacle: [0.16, 0.9, 0.16] },
  { head: 0xd8d8d8, body: 0xefefef, tentacle: 0xbdbdbd },
)

// Guardian: a blocky one-eyed puffer — squid frame with the vanilla teal
// body, tan spike tentacles reading as the spike ring.
const GUARDIAN_SPECS = buildSquidSpecs(
  { head: [0.55, 0.45, 0.55], body: [0.85, 0.85, 0.85], tentacle: [0.12, 0.4, 0.12] },
  { head: 0x5a8272, body: 0x6f9e8c, tentacle: 0xc8b48a },
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

// Villager: zombie-villager proportions with living skin + the classic brown
// robe (arms crossed under it read fine as robe-colored arm boxes).
const VILLAGER_SPECS = buildBipedSpecs(
  { head: [0.62, 0.58, 0.62], body: [0.58, 0.9, 0.32], arm: [0.22, 0.85, 0.22], leg: [0.22, 0.6, 0.22] },
  { head: 0xbd8b72, body: 0x7a5a3b, arm: 0x7a5a3b, leg: 0x52402c },
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

const SHULKER_SPECS: Readonly<Record<PartRole, Option.Option<RoleSpec>>> = {
  head: Option.some({
    size: [0.48, 0.48, 0.48],
    pivot: 'center',
    offset: { x: 0, y: 0.62 + 0.48 / 2 - 0.08, z: 0 },
    color: 0xb483b8,
    swingAxis: null,
  }),
  body: Option.some({
    size: [0.82, 0.62, 0.82],
    pivot: 'center',
    offset: { x: 0, y: 0.62 / 2, z: 0 },
    color: 0x7f4f87,
    swingAxis: null,
  }),
  armL: Option.none(),
  armR: Option.none(),
  legFL: Option.some({
    size: [0.08, 0.52, 0.82],
    pivot: 'top',
    offset: { x: +(0.82 / 2 + 0.08 / 2), y: 0.62, z: 0 },
    color: 0x4e3454,
    swingAxis: null,
  }),
  legFR: Option.some({
    size: [0.08, 0.52, 0.82],
    pivot: 'top',
    offset: { x: -(0.82 / 2 + 0.08 / 2), y: 0.62, z: 0 },
    color: 0x4e3454,
    swingAxis: null,
  }),
  legBL: Option.none(),
  legBR: Option.none(),
}

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

// Blaze: golden head cube over a molten core, orbited by six floating rods
// (four in leg slots, two in arm slots) — mirrors buildBlaze in
// mob-geometry.builders.shapes.ts. Rod swing makes them flicker like embers.
const BLAZE_ROD_SPEC = (x: number, y: number, z: number): Option.Option<RoleSpec> =>
  Option.some({
    size: [0.14, 0.6, 0.14] as const,
    pivot: 'top' as const,
    offset: { x, y, z },
    color: 0xd8940a,
    swingAxis: 'x' as const,
  })

const BLAZE_SPECS: Readonly<Record<PartRole, Option.Option<RoleSpec>>> = {
  head: Option.some({
    size: [0.45, 0.45, 0.45],
    pivot: 'center',
    offset: { x: 0, y: 0.6 + 0.14 + 0.14 + 0.45 / 2, z: 0 },
    color: 0xe8b350,
    swingAxis: null,
  }),
  body: Option.some({
    size: [0.28, 0.28, 0.28],
    pivot: 'center',
    offset: { x: 0, y: 0.6 + 0.14, z: 0 },
    color: 0xb45f04,
    swingAxis: null,
  }),
  armL: BLAZE_ROD_SPEC(+0.46, 0.88, 0),
  armR: BLAZE_ROD_SPEC(-0.46, 0.88, 0),
  legFL: BLAZE_ROD_SPEC(+0.32, 0.6, +0.32),
  legFR: BLAZE_ROD_SPEC(-0.32, 0.6, +0.32),
  legBL: BLAZE_ROD_SPEC(+0.32, 0.6, -0.32),
  legBR: BLAZE_ROD_SPEC(-0.32, 0.6, -0.32),
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
  Villager: VILLAGER_SPECS,
  Ghast: GHAST_SPECS,
  Guardian: GUARDIAN_SPECS,
  Creeper: CREEPER_SPECS,
  Skeleton: SKELETON_SPECS,
  Spider: SPIDER_SPECS,
  Enderman: ENDERMAN_SPECS,
  EnderDragon: DRAGON_SPECS,
  Endermite: ENDERMITE_SPECS,
  Shulker: SHULKER_SPECS,
  Blaze: BLAZE_SPECS,
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
  Villager: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR'],
  Ghast: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Guardian: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Creeper: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Skeleton: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR'],
  Spider: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Enderman: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR'],
  EnderDragon: ['head', 'body'],
  Endermite: ['head', 'body', 'legFL', 'legFR', 'legBL', 'legBR'],
  Shulker: ['head', 'body', 'legFL', 'legFR'],
  Blaze: ['head', 'body', 'armL', 'armR', 'legFL', 'legFR', 'legBL', 'legBR'],
}
