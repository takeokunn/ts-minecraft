import { Effect, Match, Option } from 'effect'
import * as ReadonlyArray from 'effect/Array'
import { pipe } from 'effect/Function'
import {
  AttackKind,
  CombatDomainError,
  CombatError,
  CombatEvent,
  CombatEventFactory,
  CombatSession,
  Combatant,
  CombatantId,
  Cooldown,
  CriticalChance,
  Damage,
  Timestamp,
  applyDamage,
  getCooldown,
  makeCooldown,
  makeDamage,
  overwriteSession,
  resolveDefeat,
  setCooldown,
} from './index'

export interface AttackCommand {
  readonly attacker: CombatantId
  readonly target: CombatantId
  readonly attack: AttackKind
}

export interface AttackContext {
  readonly timestamp: Timestamp
  readonly criticalRoll: CriticalChance
}

export interface AttackResolution {
  readonly session: CombatSession
  readonly event: CombatEvent
  readonly attacker: Combatant
  readonly target: Combatant
}

const findCombatant = (session: CombatSession, id: CombatantId): Effect.Effect<Combatant, CombatDomainError> => {
  const option = ReadonlyArray.findFirst(session.combatants, (combatant) => combatant.id === id)
  return Option.match(option, {
    onNone: () => Effect.fail(CombatError.combatantNotFound(id)),
    onSome: (combatant) => Effect.succeed(combatant),
  })
}

const ensureDistinctParticipants = (
  attacker: CombatantId,
  target: CombatantId
): Effect.Effect<boolean, CombatDomainError> =>
  Effect.filterOrFail(
    Effect.succeed(attacker === target),
    (equal) => equal === false,
    () => CombatError.invalidAttack('attacker and target must differ')
  )

const ensureCooldownReady = (combatant: Combatant, attack: AttackKind): Effect.Effect<void, CombatDomainError> => {
  const option = getCooldown(combatant, attack.tag)
  return Option.match(option, {
    onNone: () => Effect.void,
    onSome: (remaining) =>
      Effect.filterOrFail(
        Effect.succeed(remaining),
        (cooldown) => cooldown <= 0,
        (cooldown) => CombatError.cooldownViolation(combatant.id, attack.tag, cooldown)
      ).pipe(Effect.asVoid),
  })
}

const calculateBaseDamage = (attacker: Combatant, attack: AttackKind): Effect.Effect<Damage, CombatDomainError> =>
  Match.value(attack).pipe(
    Match.when({ tag: 'Melee' }, (melee) => makeDamage(attacker.attack + melee.baseDamage)),
    Match.when({ tag: 'Ranged' }, (ranged) => {
      const multiplier = Math.max(0.6, 1 - ranged.range / 600)
      return makeDamage((attacker.attack + ranged.baseDamage) * multiplier)
    }),
    Match.when({ tag: 'Magic' }, (magic) => {
      const intensity = 1.1 + (magic.manaCost / 60000) * 0.3
      return makeDamage((attacker.attack + magic.baseDamage) * intensity)
    }),
    Match.exhaustive
  )

const applyDefenseMitigation = (damage: Damage, defense: Defense): Effect.Effect<Damage, CombatDomainError> => {
  const mitigation = Math.max(0.25, 1 - defense / (defense + 800))
  return makeDamage(damage * mitigation)
}

const applyCriticalStrike = (
  damage: Damage,
  chance: CriticalChance,
  roll: CriticalChance
): Effect.Effect<{ readonly damage: Damage; readonly critical: boolean }, CombatDomainError> =>
  Match.value(roll <= chance).pipe(
    Match.when(true, () => makeDamage(damage * 1.5).pipe(Effect.map((next) => ({ damage: next, critical: true })))),
    Match.when(false, () => Effect.succeed({ damage, critical: false })),
    Match.exhaustive
  )

const updateCombatants = (
  session: CombatSession,
  attacker: Combatant,
  target: Combatant,
  event: CombatEvent
): CombatSession =>
  pipe(
    session.combatants,
    ReadonlyArray.map((candidate) =>
      Match.value(candidate.id).pipe(
        Match.when(attacker.id, () => attacker),
        Match.when(target.id, () => target),
        Match.orElse(() => candidate)
      )
    ),
    (participants) => overwriteSession(session, participants, event)
  )

export const resolveAttack = (
  session: CombatSession,
  command: AttackCommand,
  context: AttackContext
): Effect.Effect<AttackResolution, CombatDomainError> =>
  Effect.gen(function* () {
    yield* ensureDistinctParticipants(command.attacker, command.target)
    const attacker = yield* findCombatant(session, command.attacker)
    const target = yield* findCombatant(session, command.target)
    yield* ensureCooldownReady(attacker, command.attack)

    const baseDamage = yield* calculateBaseDamage(attacker, command.attack)
    const mitigated = yield* applyDefenseMitigation(baseDamage, target.defense)
    const outcome = yield* applyCriticalStrike(mitigated, attacker.criticalChance, context.criticalRoll)

    const nextTarget = yield* applyDamage(target, outcome.damage)
    const nextAttacker = setCooldown(attacker, command.attack.tag, command.attack.cooldown)

    const attackEvent = CombatEventFactory.attackResolved(
      attacker.id,
      target.id,
      command.attack.tag,
      outcome.damage,
      context.timestamp,
      outcome.critical
    )

    const sessionWithCombatants = updateCombatants(session, nextAttacker, nextTarget, attackEvent)
    const resolvedSession = resolveDefeat(sessionWithCombatants, nextTarget, context.timestamp)

    return {
      session: resolvedSession,
      event: attackEvent,
      attacker: nextAttacker,
      target: nextTarget,
    }
  })

export const decayCooldowns = (combatant: Combatant, elapsed: Cooldown): Effect.Effect<Combatant, CombatDomainError> =>
  Effect.gen(function* () {
    const nextCooldowns = yield* Effect.forEach(
      combatant.cooldowns,
      (entry) =>
        Effect.gen(function* () {
          const raw = (entry.remaining as number) - (elapsed as number)
          const bounded = Math.max(0, raw)
          const remaining = yield* makeCooldown(bounded)
          return { attack: entry.attack, remaining }
        }),
      { concurrency: 4 }
    )
    return {
      ...combatant,
      cooldowns: nextCooldowns,
    }
  })
