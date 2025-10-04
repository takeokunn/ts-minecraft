import { describe, expect, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import * as fc from 'effect/FastCheck'
import {
  CombatantBlueprint,
  advanceCooldowns,
  applyDamage,
  createCombatant,
  createSession,
  getCooldown,
  insertCombatant,
  setCooldown,
} from '../model'
import { AttackKindFactory, makeCooldown, makeDamage } from '../types'

describe('combat/model', () => {
  const baseBlueprint: CombatantBlueprint = {
    id: 'knight',
    health: 240,
    attack: 90,
    defense: 45,
    criticalChance: 0.2,
  }

  const createBaseCombatant = () => createCombatant(baseBlueprint)

  it.effect('createSession initialises empty collections', () =>
    Effect.gen(function* () {
      const session = yield* createSession({ id: 'session-alpha' })
      expect(session.combatants.length).toBe(0)
      expect(session.timeline.length).toBe(0)
    })
  )

  it.effect('insertCombatant prevents duplicates', () =>
    Effect.gen(function* () {
      const session = yield* createSession({ id: 'arena' })
      const fighter = yield* createBaseCombatant()
      const updated = yield* insertCombatant(session, fighter)
      expect(updated.combatants.length).toBe(1)

      const duplicateAttempt = insertCombatant(updated, fighter)
      const error = yield* duplicateAttempt.pipe(Effect.flip)
      expect(error.kind).toBe('DuplicateCombatant')
    })
  )

  it.effect('applyDamage reduces health but never below zero', () =>
    Effect.gen(function* () {
      const fighter = yield* createBaseCombatant()
      const heavyDamage = yield* makeDamage(9999)
      const damaged = yield* applyDamage(fighter, heavyDamage)
      expect(damaged.health).toBeGreaterThanOrEqual(0)
    })
  )

  it.prop('advanceCooldowns never yields negative remaining', [fc.integer({ min: 0, max: 60000 })], ([elapsed]) =>
    Effect.gen(function* () {
      const fighter = yield* createBaseCombatant()
      const attack = AttackKindFactory.melee(yield* makeDamage(70), yield* makeCooldown(5000))
      const withCooldown = setCooldown(fighter, attack.tag, attack.cooldown)
      const advanced = yield* advanceCooldowns(withCooldown, yield* makeCooldown(elapsed))
      const remaining = getCooldown(advanced, attack.tag)
      return Option.match(remaining, {
        onNone: () => {
          expect(true).toBe(true)
        },
        onSome: (value) => {
          expect(value).toBeGreaterThanOrEqual(0)
        },
      })
    })
  )
})
