import { Schema } from 'effect'
import type { Position, Vector3 } from '@ts-minecraft/core'
import { applyArmorReduction } from '../combat'

export const ShulkerShellStateSchema = Schema.Literal('closed', 'opening', 'open')
export type ShulkerShellState = Schema.Schema.Type<typeof ShulkerShellStateSchema>

export const SHULKER_OPENING_TICKS = 20
export const SHULKER_FORCED_CLOSED_TICKS = 100
export const SHULKER_CLOSED_ARMOR_POINTS = 20
export const SHULKER_TELEPORT_RADIUS = 8

export type ShulkerShellTickInput = {
  readonly ticksInState: number
  readonly health: number
  readonly maxHealth: number
  readonly damageTaken?: number
  readonly closeTicksRemaining?: number
  readonly hasTarget?: boolean
}

export type ShulkerShellTickResult = {
  readonly nextState: ShulkerShellState
  readonly isInvulnerable: boolean
  readonly canAttack: boolean
}

export type ShulkerDamageTaken = {
  readonly amount: number
  readonly currentHealth: number
  readonly maxHealth: number
}

const belowHalfHealth = (health: number, maxHealth: number): boolean =>
  maxHealth > 0 && health / maxHealth < 0.5

export const getShulkerShellArmorPoints = (state: ShulkerShellState): number =>
  state === 'closed' ? SHULKER_CLOSED_ARMOR_POINTS : 0

export const computeShulkerShellDamage = (
  rawDamage: number,
  state: ShulkerShellState,
): number => applyArmorReduction(rawDamage, getShulkerShellArmorPoints(state))

export const tickShulkerShell = (
  state: ShulkerShellState,
  input: ShulkerShellTickInput,
): ShulkerShellTickResult => {
  const damagedBelowHalf = (input.damageTaken ?? 0) > 0 && belowHalfHealth(input.health, input.maxHealth)
  const closeTicksRemaining = Math.max(0, input.closeTicksRemaining ?? 0)
  const wantsToAttack = input.hasTarget ?? true

  if (damagedBelowHalf || closeTicksRemaining > 0) {
    return { nextState: 'closed', isInvulnerable: true, canAttack: false }
  }

  if (state === 'closed') {
    const nextState = wantsToAttack ? 'opening' : 'closed'
    return { nextState, isInvulnerable: true, canAttack: false }
  }

  if (state === 'opening') {
    const nextState = input.ticksInState + 1 >= SHULKER_OPENING_TICKS ? 'open' : 'opening'
    return { nextState, isInvulnerable: false, canAttack: false }
  }

  if (!wantsToAttack) return { nextState: 'closed', isInvulnerable: true, canAttack: false }
  return { nextState: 'open', isInvulnerable: false, canAttack: true }
}

const distanceSquared = (a: Position, b: Position): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dz = b.z - a.z
  return dx * dx + dy * dy + dz * dz
}

const deterministicIndex = (pos: Position, damage: ShulkerDamageTaken, length: number): number => {
  const seed = Math.abs(
    Math.trunc(pos.x * 31 + pos.y * 17 + pos.z * 13 + damage.amount * 19 + damage.currentHealth * 7),
  )
  return seed % length
}

export const shouldShulkerTeleport = (
  shulkerPos: Position,
  damageTaken: ShulkerDamageTaken,
  neighbors: ReadonlyArray<Position>,
): Position | null => {
  if (damageTaken.amount <= 0 || !belowHalfHealth(damageTaken.currentHealth, damageTaken.maxHealth)) {
    return null
  }

  const radiusSquared = SHULKER_TELEPORT_RADIUS * SHULKER_TELEPORT_RADIUS
  const candidates: Array<Position> = []
  for (const pos of neighbors) {
    if (distanceSquared(shulkerPos, pos) <= radiusSquared) {
      candidates.push(pos)
    }
  }
  if (candidates.length === 0) return null
  return candidates[deterministicIndex(shulkerPos, damageTaken, candidates.length)] ?? null
}

export const computeShulkerBulletDirection = (
  shulkerPos: Position,
  targetPos: Position,
): Vector3 => {
  const dx = targetPos.x - shulkerPos.x
  const dy = targetPos.y - shulkerPos.y + 0.1
  const dz = targetPos.z - shulkerPos.z
  const length = Math.hypot(dx, dy, dz)
  if (length === 0) return { x: 0, y: 0, z: 0 }
  return { x: dx / length, y: dy / length, z: dz / length }
}
