import { EntityType } from '../entity'
import type { MobDefinition } from './mob-definition'

// Ocean hostile (vanilla: monument guard; here it patrols deep open water —
// there are no monuments yet). Contact damage models the spike retaliation;
// the laser is deferred. Swims via the hover mechanic, so it never sinks to
// the seabed like a land mob would.
export const GuardianDefinition: MobDefinition = {
  type: EntityType.Guardian,
  behavior: 'hostile',
  maxHealth: 30,
  attackDamage: 6,
  speed: 2.2, // deliberate underwater pursuit (player swim speed is lower than walk)
  detectionRange: 16,
  attackRange: 1.8,
  fleeHealthThreshold: 0,
  drops: [
    { blockType: 'PRISMARINE_SHARD', count: 1, maxCount: 2 },
    { blockType: 'RAW_COD', count: 1, chance: 0.4 },
  ],
  xpReward: 10,
}
