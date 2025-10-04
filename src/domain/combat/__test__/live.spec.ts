import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import {
  AttackKindFactory,
  CombatServiceLive,
  CombatServiceTag,
  makeCooldown,
  makeDamage,
} from '../index'
import type { CombatantBlueprint } from '../model'

const attackerBlueprint: CombatantBlueprint = {
  id: 'service-attacker',
  health: 320,
  attack: 150,
  defense: 30,
  criticalChance: 0.25,
}

const targetBlueprint: CombatantBlueprint = {
  id: 'service-target',
  health: 340,
  attack: 110,
  defense: 55,
  criticalChance: 0.18,
}

describe('combat/live', () => {
  it.effect('service orchestrates session lifecycle', () =>
    Effect.gen(function* () {
      const service = yield* CombatServiceTag
      const sessionId = yield* service.createSession({ id: 'service-session' })
      const attacker = yield* service.registerCombatant(sessionId, attackerBlueprint)
      const target = yield* service.registerCombatant(sessionId, targetBlueprint)

      const attack = AttackKindFactory.melee(yield* makeDamage(120), yield* makeCooldown(1500))
      const event = yield* service.executeAttack(sessionId, {
        attacker: attacker.id,
        target: target.id,
        attack,
      })
      expect(event.kind).toBe('AttackResolved')

      const timeline = yield* service.timeline(sessionId)
      expect(timeline.length).toBe(1)

      yield* service.advanceCooldowns(sessionId, 750)
      const refreshed = yield* service.getCombatant(sessionId, attacker.id)
      expect(refreshed.cooldowns.length).toBeGreaterThanOrEqual(1)
    }).pipe(Effect.provide(CombatServiceLive))
  )
})
