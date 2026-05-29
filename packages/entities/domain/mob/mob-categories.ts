import { EntityType } from './entity'

// Passive mob rotation — selected round-robin during daytime
export const PASSIVE_MOBS: ReadonlyArray<EntityType> = [
  EntityType.Cow,
  EntityType.Pig,
  EntityType.Sheep,
]

// Hostile mob rotation — selected round-robin at night
export const HOSTILE_MOBS: ReadonlyArray<EntityType> = [
  EntityType.Zombie,
  EntityType.Creeper,
  EntityType.Skeleton,
  EntityType.Spider,
  EntityType.Enderman,
]
