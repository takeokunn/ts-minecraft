import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { createCombatant, createSession, insertCombatant, type Combatant } from './model.js'
import { decayCooldowns, resolveAttack, type AttackCommand, type AttackContext } from './service.js'
import { CombatEventFactory, makeCooldown, makeCriticalChance, makeDamage, makeTimestamp } from './types.js'

const makeCombatant = (id: string, stats?: Partial<Combatant>) =>
  Effect.gen(function* () {
    const combatant = yield* createCombatant({
      id,
      health: stats?.health ?? 100,
      maxHealth: stats?.maxHealth ?? 100,
      attack: stats?.attack ?? 20,
      defense: stats?.defense ?? 10,
      criticalChance: stats?.criticalChance ?? 0.25,
    })
    return stats ? { ...combatant, ...stats } : combatant
  })

const sessionWith = (first: Combatant, second: Combatant) =>
  Effect.gen(function* () {
    const session = yield* createSession({ id: 'session-1' })
    const withFirst = yield* insertCombatant(session, first)
    return yield* insertCombatant(withFirst, second)
  })

describe('combat/service', () => {
  it.effect('resolveAttack applies damage and records event', () =>
    Effect.gen(function* () {
      const attackDamage = yield* makeDamage(25)
      const attacker = yield* makeCombatant('attacker', { attack: attackDamage })
      const target = yield* makeCombatant('target', { defense: 5 })
      const session = yield* sessionWith(attacker, target)
      const cooldown = yield* makeCooldown(1_000)
      const command: AttackCommand = {
        attacker: attacker.id,
        target: target.id,
        attack: {
          tag: 'Melee',
          baseDamage: 10,
          cooldown,
        },
      }
      const timestamp = yield* makeTimestamp(Date.now())
      const criticalRoll = yield* makeCriticalChance(0)
      const context: AttackContext = {
        timestamp,
        criticalRoll,
      }
      const result = yield* resolveAttack(session, command, context)

      expect(result.attacker.id).toEqual(attacker.id)
      expect(result.target.id).toEqual(target.id)
      expect(result.session.timeline.length).toBeGreaterThan(0)
      expect(result.event).toEqual(
        CombatEventFactory.attackResolved(
          attacker.id,
          target.id,
          command.attack.tag,
          result.event.damage,
          context.timestamp,
          result.event.critical
        )
      )
    })
  )

  it.effect('decayCooldowns reduces remaining cooldowns to zero floor', () =>
    Effect.gen(function* () {
      const base = yield* makeCombatant('mage')
      const magicCooldown = yield* makeCooldown(500)
      const meleeCooldown = yield* makeCooldown(50)
      const elapsed = yield* makeCooldown(200)
      const withCooldowns: Combatant = {
        ...base,
        cooldowns: [
          { attack: 'Magic', remaining: magicCooldown },
          { attack: 'Melee', remaining: meleeCooldown },
        ],
      }
      const decayed = yield* decayCooldowns(withCooldowns, elapsed)
      expect(decayed.cooldowns).toHaveLength(2)
      expect(Math.max(...decayed.cooldowns.map((entry) => entry.remaining))).toBeGreaterThanOrEqual(0)
    })
  )
})
