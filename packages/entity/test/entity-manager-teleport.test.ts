import { describe, expect, it } from 'vitest'
import {
  makeTeleportAttempts,
  makeEndermanTeleportRolls,
} from '@ts-minecraft/entity/application/mob/entity-manager-teleport'
import { TELEPORT_ATTEMPTS } from '@ts-minecraft/entity/domain/mob/enderman-teleport'
import { EntityId } from '@ts-minecraft/entity/domain/mob/entity'
import type { ManagedEntity } from '@ts-minecraft/entity/domain/mob/entity-internal'

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeEntity = (id: string, health: number): ManagedEntity =>
  ({ entityId: EntityId.make(id), health }) as unknown as ManagedEntity

// ─── makeEndermanTeleportRolls ────────────────────────────────────────────────
describe('makeEndermanTeleportRolls', () => {
  it('returns exactly TELEPORT_ATTEMPTS * 2 rolls', () => {
    const rolls = makeEndermanTeleportRolls(0, 0)
    expect(rolls).toHaveLength(TELEPORT_ATTEMPTS * 2)
  })

  it('all rolls are in [0, 1)', () => {
    const rolls = makeEndermanTeleportRolls(42, 100)
    for (const roll of rolls) {
      expect(roll).toBeGreaterThanOrEqual(0)
      expect(roll).toBeLessThan(1)
    }
  })

  it('is deterministic: same hash + tick → identical output', () => {
    const a = makeEndermanTeleportRolls(999, 77)
    const b = makeEndermanTeleportRolls(999, 77)
    expect(a).toEqual(b)
  })

  it('changes output when tick changes', () => {
    const a = makeEndermanTeleportRolls(0, 0)
    const b = makeEndermanTeleportRolls(0, 1)
    expect(a).not.toEqual(b)
  })

  it('changes output when hash changes', () => {
    const a = makeEndermanTeleportRolls(0, 0)
    const b = makeEndermanTeleportRolls(1, 0)
    expect(a).not.toEqual(b)
  })

  it('consecutive indices produce different rolls (no degenerate constant sequence)', () => {
    const rolls = makeEndermanTeleportRolls(0, 0)
    const unique = new Set(rolls.map((r) => r.toFixed(6)))
    // With 977-step LCG over 32 values, we expect many distinct values
    expect(unique.size).toBeGreaterThan(1)
  })

  it('uses pairs: even index is x-roll, odd index is z-roll for each attempt', () => {
    // The consumer (computeEndermanTeleportTarget) reads [attempt*2] and [attempt*2+1]
    // so the array must be at least 2*TELEPORT_ATTEMPTS in length
    const rolls = makeEndermanTeleportRolls(0, 0)
    expect(rolls[TELEPORT_ATTEMPTS * 2 - 1]).toBeDefined()
  })
})

// ─── makeTeleportAttempts ─────────────────────────────────────────────────────
describe('makeTeleportAttempts', () => {
  it('returns exactly TELEPORT_ATTEMPTS * 2 rolls', () => {
    const entity = makeEntity('zombie-1', 20)
    const rolls = makeTeleportAttempts(entity, 0)
    expect(rolls).toHaveLength(TELEPORT_ATTEMPTS * 2)
  })

  it('all rolls are in [0, 1)', () => {
    const entity = makeEntity('zombie-test', 10)
    const rolls = makeTeleportAttempts(entity, 5)
    for (const roll of rolls) {
      expect(roll).toBeGreaterThanOrEqual(0)
      expect(roll).toBeLessThan(1)
    }
  })

  it('is deterministic: same entity + salt → identical output', () => {
    const entity = makeEntity('enderman-1', 40)
    const a = makeTeleportAttempts(entity, 3)
    const b = makeTeleportAttempts(entity, 3)
    expect(a).toEqual(b)
  })

  it('changes output when salt changes', () => {
    const entity = makeEntity('enderman-1', 40)
    const a = makeTeleportAttempts(entity, 0)
    const b = makeTeleportAttempts(entity, 1)
    expect(a).not.toEqual(b)
  })

  it('changes output when entity health changes', () => {
    const a = makeTeleportAttempts(makeEntity('enderman-1', 20), 0)
    const b = makeTeleportAttempts(makeEntity('enderman-1', 10), 0)
    expect(a).not.toEqual(b)
  })

  it('changes output for different entity ids (different hash)', () => {
    const a = makeTeleportAttempts(makeEntity('enderman-alpha', 20), 0)
    const b = makeTeleportAttempts(makeEntity('enderman-beta', 20), 0)
    expect(a).not.toEqual(b)
  })

  it('produces varied rolls (not a constant sequence)', () => {
    const entity = makeEntity('zombie-varied', 20)
    const rolls = makeTeleportAttempts(entity, 7)
    const unique = new Set(rolls.map((r) => r.toFixed(6)))
    expect(unique.size).toBeGreaterThan(1)
  })
})
