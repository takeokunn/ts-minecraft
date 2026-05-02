import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'
import { ZombieDefinition } from './zombie'
import { CowDefinition } from './cow'
import { PigDefinition } from './pig'
import { SheepDefinition } from './sheep'

export type { MobDefinition } from './mob-definition'
export { ZombieDefinition } from './zombie'
export { CowDefinition } from './cow'
export { PigDefinition } from './pig'
export { SheepDefinition } from './sheep'

export const MobDefinitions: Readonly<Record<EntityType, MobDefinition>> = {
  [EntityType.Zombie]: ZombieDefinition,
  [EntityType.Cow]: CowDefinition,
  [EntityType.Pig]: PigDefinition,
  [EntityType.Sheep]: SheepDefinition,
}

export const getMobDefinition = (entityType: EntityType): MobDefinition =>
  MobDefinitions[entityType]
