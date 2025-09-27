import { Schema } from '@effect/schema'
import {
  AttackDamage,
  DefenseValue,
  KnockbackForce,
  AttackCooldown,
  Durability
} from './types'
import type {
  AttackDamage as TAttackDamage,
  DefenseValue as TDefenseValue,
  KnockbackForce as TKnockbackForce,
  AttackCooldown as TAttackCooldown,
  Durability as TDurability
} from './types'

export const createAttackDamage = (damage: number): TAttackDamage => Schema.decodeSync(AttackDamage)(damage)
export const createDefenseValue = (defense: number): TDefenseValue => Schema.decodeSync(DefenseValue)(defense)
export const createKnockbackForce = (force: number): TKnockbackForce => Schema.decodeSync(KnockbackForce)(force)
export const createAttackCooldown = (cooldown: number): TAttackCooldown => Schema.decodeSync(AttackCooldown)(cooldown)
export const createDurability = (durability: number): TDurability => Schema.decodeSync(Durability)(durability)
