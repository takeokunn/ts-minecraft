import type { ItemStack } from '@/domain/item-stack'
import type { AIState } from '@/ai/stateMachine'
import type { Entity, MobBehavior } from '@/entity/entity'
import type { Vector3 } from '@/shared/math/three'

export const HOSTILE_ATTACK_COOLDOWN_SECS = 1

export type ManagedEntity = Entity & {
  readonly behavior: MobBehavior
  readonly maxHealth: number
  readonly attackDamage: number
  readonly speed: number
  readonly detectionRange: number
  readonly attackRange: number
  readonly fleeHealthThreshold: number
  readonly drops: ReadonlyArray<ItemStack>
  readonly aiState: AIState
  readonly wanderDirection: Vector3
  readonly attackCooldownRemaining: number
}
