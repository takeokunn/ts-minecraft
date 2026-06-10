import type { EntityDrop } from './drop'
import type { AIState } from './state-machine'
import type { Entity, MobBehavior } from './entity'
import type { Vector3 } from '@ts-minecraft/core'

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
  readonly stuckTicks: number
  // Seconds a creeper's detonation fuse has burned (0 for non-creepers and for any
  // creeper not currently within ignition range). At CREEPER_FUSE_SECONDS the
  // creeper detonates (see getPlayerContactDamage).
  readonly fuseSecs: number
  // Breeding (FR R6 — see domain/mob/breeding.ts): love window (>0 = in love),
  // post-breed cooldown, and age (>= BABY_GROW_TICKS = adult). Spawned mobs are adults.
  readonly loveTicksRemaining: number
  readonly breedCooldownRemaining: number
  readonly ageTicks: number
  // Shearing (FR R11 — see domain/mob/shearing.ts): 0 = woolly/shearable,
  // > 0 = sheared and counting down to wool regrowth. Sheep-only in practice.
  readonly woolRegrowthTicks: number
}
