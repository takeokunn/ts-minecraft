import type { ItemStack } from '@ts-minecraft/domain'
import type { AIState } from './stateMachine'
import type { Entity, MobBehavior } from './entity'
import type { Vector3 } from '@ts-minecraft/kernel'

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
