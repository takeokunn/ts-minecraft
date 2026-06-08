import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'
import { ZombieDefinition } from './zombie'
import { CowDefinition } from './cow'
import { PigDefinition } from './pig'
import { SheepDefinition } from './sheep'
import { CreeperDefinition } from './creeper'
import { SkeletonDefinition } from './skeleton'
import { SpiderDefinition } from './spider'
import { EndermanDefinition } from './enderman'
import { EnderDragonDefinition } from './ender-dragon'
import { ShulkerDefinition } from './shulker'
import { EndermiteDefinition } from './endermite'

export type { MobDefinition } from './mob-definition'
export { ZombieDefinition } from './zombie'
export { CowDefinition } from './cow'
export { PigDefinition } from './pig'
export { SheepDefinition } from './sheep'
export { CreeperDefinition } from './creeper'
export { SkeletonDefinition } from './skeleton'
export { SpiderDefinition } from './spider'
export { EndermanDefinition } from './enderman'
export { EnderDragonDefinition } from './ender-dragon'
export { ShulkerDefinition } from './shulker'
export { EndermiteDefinition } from './endermite'

export const MobDefinitions = {
  [EntityType.Zombie]: ZombieDefinition,
  [EntityType.Cow]: CowDefinition,
  [EntityType.Pig]: PigDefinition,
  [EntityType.Sheep]: SheepDefinition,
  [EntityType.Creeper]: CreeperDefinition,
  [EntityType.Skeleton]: SkeletonDefinition,
  [EntityType.Spider]: SpiderDefinition,
  [EntityType.Enderman]: EndermanDefinition,
  [EntityType.EnderDragon]: EnderDragonDefinition,
  [EntityType.Shulker]: ShulkerDefinition,
  [EntityType.Endermite]: EndermiteDefinition,
} as Readonly<Record<EntityType, MobDefinition>>

export const getMobDefinition = (entityType: EntityType): MobDefinition =>
  MobDefinitions[entityType]
