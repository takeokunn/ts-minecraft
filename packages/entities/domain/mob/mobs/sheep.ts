import type { BlockType } from '@ts-minecraft/kernel'
import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

export const SheepDefinition: MobDefinition = {
  type: EntityType.Sheep,
  behavior: 'passive',
  maxHealth: 8,
  attackDamage: 0,
  speed: 0.95,
  detectionRange: 10,
  attackRange: 0,
  fleeHealthThreshold: 0.7,
  drops: [{ blockType: 'LEAVES' as BlockType, count: 1 }],
}
