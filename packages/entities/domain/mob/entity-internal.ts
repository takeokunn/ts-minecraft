import type { EntityDrop } from './drop'
import type { AIState } from './state-machine'
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
  readonly drops: ReadonlyArray<EntityDrop>
  readonly aiState: AIState
  readonly wanderDirection: Vector3
  readonly attackCooldownRemaining: number
  readonly isGrounded: boolean
  // > 0 while a combat knockback impulse is active; AI yields horizontal velocity
  // control for this many update ticks so the shove is not immediately overwritten.
  readonly knockbackTicksRemaining: number
}
