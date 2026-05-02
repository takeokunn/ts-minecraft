import type { BlockType } from '@ts-minecraft/kernel'
import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

export const PigDefinition: MobDefinition = {
  type: EntityType.Pig,
  behavior: 'passive',
  maxHealth: 10,
  attackDamage: 0,
  speed: 1.05,
  detectionRange: 10,
  attackRange: 0,
  fleeHealthThreshold: 0.65,
  drops: [{ blockType: 'DIRT' as BlockType, count: 1 }],
}
