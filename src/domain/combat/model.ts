import { Effect, Match, Option } from 'effect'
import * as ReadonlyArray from 'effect/Array'
import { pipe } from 'effect/Function'
import {
  AttackLabel,
  CombatDomainError,
  CombatError,
  CombatEvent,
  CombatEventFactory,
  CombatantId,
  Cooldown,
  CriticalChance,
  Damage,
  Defense,
  Health,
  SessionId,
  Timestamp,
  makeCombatantId,
  makeCooldown,
  makeCriticalChance,
  makeDamage,
  makeDefense,
  makeHealth,
  makeSessionId,
} from './index'

export interface CombatantBlueprint {
  readonly id: string
  readonly health: number
  readonly maxHealth?: number
  readonly attack: number
  readonly defense: number
  readonly criticalChance: number
}

export interface CombatSessionBlueprint {
  readonly id: string
}

export interface CooldownState {
  readonly attack: AttackLabel
  readonly remaining: Cooldown
}

export interface Combatant {
  readonly id: CombatantId
  readonly health: Health
  readonly maxHealth: Health
  readonly attack: Damage
  readonly defense: Defense
  readonly criticalChance: CriticalChance
  readonly cooldowns: ReadonlyArray<CooldownState>
}

export interface CombatSession {
  readonly id: SessionId
  readonly combatants: ReadonlyArray<Combatant>
  readonly timeline: ReadonlyArray<CombatEvent>
}

const emptyCooldowns: ReadonlyArray<CooldownState> = []

export const createSession = (blueprint: CombatSessionBlueprint): Effect.Effect<CombatSession, CombatDomainError> =>
  Effect.gen(function* () {
    const id = yield* makeSessionId(blueprint.id)
    return {
      id,
      combatants: [],
      timeline: [],
    }
  })

export const createCombatant = (blueprint: CombatantBlueprint): Effect.Effect<Combatant, CombatDomainError> =>
  Effect.gen(function* () {
    const id = yield* makeCombatantId(blueprint.id)
    const maxHealth = yield* pipe(
      Option.fromNullable(blueprint.maxHealth),
      Option.match({
        onSome: makeHealth,
        onNone: () => makeHealth(blueprint.health),
      })
    )
    const health = yield* makeHealth(blueprint.health)
    yield* Effect.filterOrFail(
      Effect.succeed({ current: health, max: maxHealth }),
      (state) => state.current <= state.max,
      () => CombatError.invalidStat('health', health, 'current health must be <= max health')
    )
    const attack = yield* makeDamage(blueprint.attack)
    const defense = yield* makeDefense(blueprint.defense)
    const criticalChance = yield* makeCriticalChance(blueprint.criticalChance)
    return {
      id,
      health,
      maxHealth,
      attack,
      defense,
      criticalChance,
      cooldowns: emptyCooldowns,
    }
  })

const replaceCombatant = (combatants: ReadonlyArray<Combatant>, updated: Combatant): ReadonlyArray<Combatant> =>
  pipe(
    combatants,
    ReadonlyArray.map((candidate) =>
      Match.value(candidate.id).pipe(
        Match.when(updated.id, () => updated),
        Match.orElse(() => candidate)
      )
    )
  )

export const insertCombatant = (
  session: CombatSession,
  combatant: Combatant
): Effect.Effect<CombatSession, CombatDomainError> =>
  pipe(
    session.combatants,
    ReadonlyArray.findFirst((candidate) => candidate.id === combatant.id),
    Option.match({
      onSome: () => Effect.fail(CombatError.duplicateCombatant(session.id, combatant.id)),
      onNone: () =>
        Effect.succeed<CombatSession>({
          id: session.id,
          combatants: ReadonlyArray.append(session.combatants, combatant),
          timeline: session.timeline,
        }),
    })
  )

export const updateCombatant = (
  session: CombatSession,
  combatantId: CombatantId,
  mutate: (combatant: Combatant) => Effect.Effect<Combatant, CombatDomainError>
): Effect.Effect<CombatSession, CombatDomainError> => {
  const option = ReadonlyArray.findFirst(
    session.combatants,
    (candidate) => candidate.id === combatantId
  )
  return Option.match(option, {
    onNone: () => Effect.fail(CombatError.combatantNotFound(combatantId)),
    onSome: (current) =>
      mutate(current).pipe(
        Effect.map((updated) => ({
          id: session.id,
          combatants: replaceCombatant(session.combatants, updated),
          timeline: session.timeline,
        }))
      ),
  })
}

export const appendEvent = (session: CombatSession, event: CombatEvent): CombatSession => ({
  id: session.id,
  combatants: session.combatants,
  timeline: ReadonlyArray.append(session.timeline, event),
})

const upsertCooldown = (
  cooldowns: ReadonlyArray<CooldownState>,
  attack: AttackLabel,
  remaining: Cooldown
): ReadonlyArray<CooldownState> =>
  pipe(
    cooldowns,
    ReadonlyArray.filter((entry) => entry.attack !== attack),
    (rest) => ReadonlyArray.append(rest, { attack, remaining })
  )

export const setCooldown = (combatant: Combatant, attack: AttackLabel, remaining: Cooldown): Combatant => ({
  ...combatant,
  cooldowns: upsertCooldown(combatant.cooldowns, attack, remaining),
})

export const getCooldown = (combatant: Combatant, attack: AttackLabel): Option.Option<Cooldown> =>
  pipe(
    combatant.cooldowns,
    ReadonlyArray.findFirst((entry) => entry.attack === attack),
    Option.map((entry) => entry.remaining)
  )

export const applyDamage = (combatant: Combatant, damage: Damage): Effect.Effect<Combatant, CombatDomainError> =>
  Effect.gen(function* () {
    const numeric = combatant.health - damage
    const safe = Math.max(0, numeric)
    const nextHealth = yield* makeHealth(safe)
    return {
      ...combatant,
      health: nextHealth,
    }
  })

export const resolveDefeat = (session: CombatSession, target: Combatant, timestamp: Timestamp): CombatSession =>
  Match.value(target.health > 0).pipe(
    Match.when(true, () => session),
    Match.when(false, () => appendEvent(session, CombatEventFactory.combatantDefeated(target.id, timestamp))),
    Match.exhaustive
  )

export const replaceCombatants = (session: CombatSession, combatants: ReadonlyArray<Combatant>): CombatSession => ({
  id: session.id,
  combatants,
  timeline: session.timeline,
})

export const overwriteSession = (
  session: CombatSession,
  nextCombatants: ReadonlyArray<Combatant>,
  event: CombatEvent
): CombatSession => ({
  id: session.id,
  combatants: nextCombatants,
  timeline: ReadonlyArray.append(session.timeline, event),
})

export const advanceCooldowns = (
  combatant: Combatant,
  elapsed: Cooldown
): Effect.Effect<Combatant, CombatDomainError> =>
  Effect.gen(function* () {
    const updated = yield* Effect.forEach(
      combatant.cooldowns,
      (entry) =>
        Effect.gen(function* () {
          const numeric = (entry.remaining as number) - (elapsed as number)
          const bounded = numeric <= 0 ? 0 : numeric
          const remaining = yield* makeCooldown(bounded)
          return { attack: entry.attack, remaining }
        }),
      { concurrency: 'unbounded' }
    )
    return {
      ...combatant,
      cooldowns: updated,
    }
  })
export const timelineWithEvent = (session: CombatSession, event: CombatEvent): CombatSession =>
  appendEvent(session, event)
