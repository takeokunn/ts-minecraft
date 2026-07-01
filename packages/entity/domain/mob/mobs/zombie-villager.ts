import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'
import { ZOMBIE_BASE_DROPS, ZOMBIE_BASE_STATS } from './zombie'

export const ZombieVillagerDefinition: MobDefinition = {
  ...ZOMBIE_BASE_STATS,
  type: EntityType.ZombieVillager,
  behavior: 'hostile',
  drops: ZOMBIE_BASE_DROPS,
}
