import { EntityType } from '@/entity/entity'
import type { MobDefinition } from '@/entity/mobs/mob-definition'
import { ZombieDefinition } from '@/entity/mobs/zombie'
import { CowDefinition } from '@/entity/mobs/cow'
import { PigDefinition } from '@/entity/mobs/pig'
import { SheepDefinition } from '@/entity/mobs/sheep'

export type { MobDefinition } from '@/entity/mobs/mob-definition'
export { ZombieDefinition } from '@/entity/mobs/zombie'
export { CowDefinition } from '@/entity/mobs/cow'
export { PigDefinition } from '@/entity/mobs/pig'
export { SheepDefinition } from '@/entity/mobs/sheep'

export const MobDefinitions: Readonly<Record<EntityType, MobDefinition>> = {
  [EntityType.Zombie]: ZombieDefinition,
  [EntityType.Cow]: CowDefinition,
  [EntityType.Pig]: PigDefinition,
  [EntityType.Sheep]: SheepDefinition,
}

export const getMobDefinition = (entityType: EntityType): MobDefinition =>
  MobDefinitions[entityType]
