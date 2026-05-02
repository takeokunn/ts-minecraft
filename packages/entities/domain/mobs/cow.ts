import type { BlockType } from '@ts-minecraft/kernel'
import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

export const CowDefinition: MobDefinition = {
  type: EntityType.Cow,
  behavior: 'passive',
  maxHealth: 10,
  attackDamage: 0,
  speed: 1.0,
  detectionRange: 12,
  attackRange: 0,
  fleeHealthThreshold: 0.6,
  drops: [{ blockType: 'GRASS' as BlockType, count: 1 }],
}
