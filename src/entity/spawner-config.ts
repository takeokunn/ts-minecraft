import { EntityType } from '@/entity/entity'

/** Distance band for mob spawning around the player (in blocks) */
export const MIN_SPAWN_DISTANCE = 16
export const MAX_SPAWN_DISTANCE = 40

/** Maximum total mob population before spawning is suppressed */
export const MAX_ENTITY_COUNT = 24

/** Spawn is attempted every N frames (throttles CPU cost) */
export const SPAWN_INTERVAL_FRAMES = 6

/** Passive mob rotation — selected round-robin during daytime */
export const PASSIVE_MOBS: ReadonlyArray<EntityType> = [
  EntityType.Cow,
  EntityType.Pig,
  EntityType.Sheep,
]
