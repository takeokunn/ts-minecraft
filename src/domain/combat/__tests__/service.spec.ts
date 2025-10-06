import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import { CombatantBlueprint, createCombatant, createSession, insertCombatant, replaceCombatants } from '../model'
import { AttackCommand, AttackContext, resolveAttack } from '../service'
import {
  AttackKindFactory,
  makeAttackRange,
  makeCooldown,
  makeCriticalChance,
  makeDamage,
  makeTimestamp,
} from '../types'

describe('combat/service', () => {
  const attackerBlueprint: CombatantBlueprint = {
    id: 'attacker',
    health: 400,
    attack: 160,
    defense: 30,
    criticalChance: 0.3,
  }

  const targetBlueprint: CombatantBlueprint = {
    id: 'target',
    health: 500,
    attack: 120,
    defense: 60,
    criticalChance: 0.1,
  }

  const prepareSession = () =>
    Effect.gen(function* () {
      const session = yield* createSession({ id: 'arena-main' })
      const attacker = yield* createCombatant(attackerBlueprint)
      const target = yield* createCombatant(targetBlueprint)
      const withAttacker = yield* insertCombatant(session, attacker)
      const withTarget = yield* insertCombatant(withAttacker, target)
      return { session: withTarget, attacker, target }
    })

  it.effect('resolveAttack produces attack event and updates session timeline', () =>
    Effect.gen(function* () {
      const { session, attacker, target } = yield* prepareSession()
      const damage = yield* makeDamage(140)
      const cooldown = yield* makeCooldown(1200)
      const range = yield* makeAttackRange(40)
      const attack = AttackKindFactory.ranged(damage, cooldown, range)
      const command: AttackCommand = {
        attacker: attacker.id,
        target: target.id,
        attack,
      }
      const context: AttackContext = {
        timestamp: yield* makeTimestamp(5000),
        criticalRoll: yield* makeCriticalChance(0.05),
      }
      const outcome = yield* resolveAttack(session, command, context)
      expect(outcome.event.kind).toBe('AttackResolved')
      expect(outcome.session.timeline.length).toBe(1)
      expect(outcome.target.health).toBeLessThan(target.health)
    })
  )

  it.effect('resolveAttack rejects actions when attacker equals target', () =>
    Effect.gen(function* () {
      const { session, attacker } = yield* prepareSession()
      const attack = AttackKindFactory.melee(yield* makeDamage(80), yield* makeCooldown(600))
      const command: AttackCommand = {
        attacker: attacker.id,
        target: attacker.id,
        attack,
      }
      const context: AttackContext = {
        timestamp: yield* makeTimestamp(0),
        criticalRoll: yield* makeCriticalChance(0.2),
      }
      const failure = resolveAttack(session, command, context)
      const error = yield* failure.pipe(Effect.flip)
      expect(error.kind).toBe('InvalidAttack')
    })
  )

  it.effect('resolveAttack fails when cooldown remains', () =>
    Effect.gen(function* () {
      const { session, attacker, target } = yield* prepareSession()
      const attack = AttackKindFactory.magic(
        yield* makeDamage(100),
        yield* makeCooldown(4000),
        yield* makeCooldown(2000)
      )
      const chilledAttacker = {
        ...attacker,
        cooldowns: [{ attack: attack.tag, remaining: attack.cooldown }],
      }
      const cooledSession = replaceCombatants(session, [chilledAttacker, target])
      const command: AttackCommand = {
        attacker: chilledAttacker.id,
        target: target.id,
        attack,
      }
      const context: AttackContext = {
        timestamp: yield* makeTimestamp(100),
        criticalRoll: yield* makeCriticalChance(0.1),
      }
      const failure = resolveAttack(cooledSession, command, context)
      const error = yield* failure.pipe(Effect.flip)
      expect(error.kind).toBe('CooldownViolation')
    })
  )

  it.prop('resolved attacks never increase target health', [fc.integer({ min: 20, max: 240 })], ([base]) =>
    Effect.gen(function* () {
      const { session, attacker, target } = yield* prepareSession()
      const damage = yield* makeDamage(base)
      const attack = AttackKindFactory.melee(damage, yield* makeCooldown(800))
      const command: AttackCommand = {
        attacker: attacker.id,
        target: target.id,
        attack,
      }
      const context: AttackContext = {
        timestamp: yield* makeTimestamp(3000),
        criticalRoll: yield* makeCriticalChance(0.5),
      }
      const result = yield* resolveAttack(session, command, context)
      return result.target.health <= target.health
    })
  )
})
