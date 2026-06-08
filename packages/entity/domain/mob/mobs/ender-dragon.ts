import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

// The Ender Dragon — the final boss of Minecraft.
// 200 HP, very high melee damage, flies around The End island.
// No dragon breath (simplified); drops 12000 XP + ender pearl on death.
export const EnderDragonDefinition: MobDefinition = {
  type: EntityType.EnderDragon,
  behavior: 'hostile',
  maxHealth: 200,
  attackDamage: 15,
  speed: 0.8,
  detectionRange: 96,
  attackRange: 4.0,
  fleeHealthThreshold: 0,     // never flees
  drops: [{ blockType: 'ENDER_PEARL', count: 1 }],
  xpReward: 12000,
}
