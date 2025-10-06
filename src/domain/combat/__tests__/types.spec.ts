import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import {
  AttackKindFactory,
  AttackLabel,
  CombatEventFactory,
  makeAttackRange,
  makeCombatantId,
  makeCooldown,
  makeCriticalChance,
  makeDamage,
  makeHealth,
  makeTimestamp,
} from '../types'

describe('combat/types', () => {
  it.effect('makeCombatantId trims and normalises input', () =>
    Effect.gen(function* () {
      const identifier = yield* makeCombatantId('  Warrior_01  ')
      expect(identifier).toBe('warrior_01')
    })
  )

  it.effect('makeCombatantId rejects invalid characters', () =>
    makeCombatantId('???').pipe(
      Effect.flip,
      Effect.map((error) => {
        expect(error.kind).toBe('InvalidIdentifier')
        expect(error.reason).toContain('alphanumeric')
      })
    )
  )

  it.prop('makeHealth rejects negative values', [fc.float({ max: Math.fround(-0.0001) })], ([value]) => {
    const outcome = Effect.runSync(Effect.either(makeHealth(value)))
    expect(outcome).toMatchObject({ _tag: 'Left' })
    if (outcome._tag === 'Left') {
      expect(outcome.left.kind).toBe('InvalidStat')
      expect(outcome.left.stat).toBe('health')
    }
    return true
  })

  it.prop('makeCriticalChance accepts probabilities in range [0,1]', [fc.float({ min: Math.fround(0), max: Math.fround(1) })], ([value]) => {
    const chance = Effect.runSync(makeCriticalChance(value))
    expect(chance).toBeGreaterThanOrEqual(0)
    expect(chance).toBeLessThanOrEqual(1)
    return true
  })

  it.effect('AttackKindFactory produces well tagged variants', () =>
    Effect.gen(function* () {
      const damage = yield* makeDamage(120)
      const cooldown = yield* makeCooldown(1500)
      const range = yield* makeAttackRange(45)
      const mana = yield* makeCooldown(900)

      const melee = AttackKindFactory.melee(damage, cooldown)
      const ranged = AttackKindFactory.ranged(damage, cooldown, range)
      const magic = AttackKindFactory.magic(damage, cooldown, mana)

      const tags: ReadonlyArray<AttackLabel> = [melee.tag, ranged.tag, magic.tag]
      expect(tags).toStrictEqual(['Melee', 'Ranged', 'Magic'])
    })
  )

  it.effect('CombatEventFactory.attackResolved encodes critical flag', () =>
    Effect.gen(function* () {
      const attacker = yield* makeCombatantId('attacker')
      const target = yield* makeCombatantId('target')
      const damage = yield* makeDamage(64)
      const timestamp = yield* makeTimestamp(0)
      const event = CombatEventFactory.attackResolved(attacker, target, 'Melee', damage, timestamp, true)
      expect(event.kind).toBe('AttackResolved')
      expect(event.critical).toBe(true)
    })
  )
})
