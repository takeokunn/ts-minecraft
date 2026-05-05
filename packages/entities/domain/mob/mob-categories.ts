import { EntityType } from './entity'

// Passive mob rotation — selected round-robin during daytime
export const PASSIVE_MOBS: ReadonlyArray<EntityType> = [
  EntityType.Cow,
  EntityType.Pig,
  EntityType.Sheep,
]
