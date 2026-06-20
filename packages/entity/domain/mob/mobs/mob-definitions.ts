import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'
import { BatDefinition } from './bat'
import { BeeDefinition } from './bee'
import { ChickenDefinition } from './chicken'
import { CowDefinition } from './cow'
import { CreeperDefinition } from './creeper'
import { DrownedDefinition } from './drowned'
import { EnderDragonDefinition } from './ender-dragon'
import { EndermiteDefinition } from './endermite'
import { EndermanDefinition } from './enderman'
import { GlowSquidDefinition, SquidDefinition } from './squid'
import { PigDefinition } from './pig'
import { ShulkerDefinition } from './shulker'
import { SheepDefinition } from './sheep'
import { SkeletonDefinition } from './skeleton'
import { SpiderDefinition } from './spider'
import { WitchDefinition } from './witch'
import { ZombieDefinition } from './zombie'
import { ZombieVillagerDefinition } from './zombie-villager'

export const MobDefinitions = {
  [EntityType.Zombie]: ZombieDefinition,
  [EntityType.Cow]: CowDefinition,
  [EntityType.Pig]: PigDefinition,
  [EntityType.Sheep]: SheepDefinition,
  [EntityType.Chicken]: ChickenDefinition,
  [EntityType.Bat]: BatDefinition,
  [EntityType.Bee]: BeeDefinition,
  [EntityType.Squid]: SquidDefinition,
  [EntityType.GlowSquid]: GlowSquidDefinition,
  [EntityType.Witch]: WitchDefinition,
  [EntityType.Drowned]: DrownedDefinition,
  [EntityType.ZombieVillager]: ZombieVillagerDefinition,
  [EntityType.Creeper]: CreeperDefinition,
  [EntityType.Skeleton]: SkeletonDefinition,
  [EntityType.Spider]: SpiderDefinition,
  [EntityType.Enderman]: EndermanDefinition,
  [EntityType.EnderDragon]: EnderDragonDefinition,
  [EntityType.Shulker]: ShulkerDefinition,
  [EntityType.Endermite]: EndermiteDefinition,
} as Readonly<Record<EntityType, MobDefinition>>
