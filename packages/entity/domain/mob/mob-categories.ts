import { EntityType } from './entity'

// Passive mob rotation — selected round-robin during daytime
export const PASSIVE_MOBS: ReadonlyArray<EntityType> = [
  EntityType.Cow,
  EntityType.Pig,
  EntityType.Sheep,
  EntityType.Chicken,
  EntityType.Bat,
  EntityType.Bee,
  EntityType.Squid,
  EntityType.GlowSquid,
]

// Hostile mob rotation — selected round-robin at night
export const HOSTILE_MOBS: ReadonlyArray<EntityType> = [
  EntityType.Zombie,
  EntityType.Creeper,
  EntityType.Skeleton,
  EntityType.Spider,
  EntityType.Enderman,
  EntityType.Witch,
  EntityType.Drowned,
  EntityType.ZombieVillager,
]

// Nether rotation away from fortresses (near a fortress the spawner always
// picks a Blaze). The nether has no day/night, so this rotation applies at
// any time of day.
export const NETHER_HOSTILE_MOBS: ReadonlyArray<EntityType> = [
  EntityType.Skeleton,
  EntityType.Enderman,
  EntityType.Zombie,
  EntityType.Ghast,
]

// All Blaze/nether-category mobs are hostile; combined set used for the
// category population cap.
export const ALL_HOSTILE_MOBS: ReadonlyArray<EntityType> = [
  ...HOSTILE_MOBS,
  EntityType.Blaze,
  EntityType.Ghast,
]
