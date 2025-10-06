import { Context, Effect, HashMap, Layer, Option, Random, Ref } from 'effect'
import * as ReadonlyArray from 'effect/Array'
import { pipe } from 'effect/Function'
import {
  AttackCommand,
  AttackContext,
  CombatDomainError,
  CombatError,
  CombatEvent,
  CombatSession,
  CombatSessionBlueprint,
  Combatant,
  CombatantBlueprint,
  CombatantId,
  SessionId,
  createSession as createCombatSession,
  createCombatant,
  currentTimestamp,
  decayCooldowns,
  insertCombatant,
  makeCooldown,
  makeCriticalChance,
  resolveAttack,
} from './index'

export interface CombatService {
  readonly createSession: (blueprint: CombatSessionBlueprint) => Effect.Effect<SessionId, CombatDomainError>
  readonly registerCombatant: (
    sessionId: SessionId,
    blueprint: CombatantBlueprint
  ) => Effect.Effect<Combatant, CombatDomainError>
  readonly executeAttack: (
    sessionId: SessionId,
    command: AttackCommand
  ) => Effect.Effect<CombatEvent, CombatDomainError>
  readonly advanceCooldowns: (
    sessionId: SessionId,
    elapsedMilliseconds: number
  ) => Effect.Effect<void, CombatDomainError>
  readonly getCombatant: (sessionId: SessionId, combatantId: CombatantId) => Effect.Effect<Combatant, CombatDomainError>
  readonly timeline: (sessionId: SessionId) => Effect.Effect<ReadonlyArray<CombatEvent>, CombatDomainError>
}

export const CombatServiceTag = Context.GenericTag<CombatService>('@domain/combat/CombatService')

export const CombatServiceLive = Layer.effect(
  CombatServiceTag,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(HashMap.empty<SessionId, CombatSession>())

    const getSession = (sessionId: SessionId): Effect.Effect<CombatSession, CombatDomainError> =>
      Ref.get(stateRef).pipe(
        Effect.flatMap((state) => {
          const option = HashMap.get(state, sessionId)
          return Option.match(option, {
            onNone: () => Effect.fail(CombatError.sessionNotFound(sessionId)),
            onSome: (session) => Effect.succeed(session),
          })
        })
      )

    const modifySession = <A>(
      sessionId: SessionId,
      fn: (session: CombatSession) => Effect.Effect<readonly [A, CombatSession], CombatDomainError>
    ): Effect.Effect<A, CombatDomainError> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const sessionOption = HashMap.get(state, sessionId)
        const session = yield* pipe(
          sessionOption,
          Option.match({
            onNone: () => Effect.fail(CombatError.sessionNotFound(sessionId)),
            onSome: (s) => Effect.succeed(s),
          })
        )
        const [result, nextSession] = yield* fn(session)
        const nextState = HashMap.set(state, sessionId, nextSession)
        yield* Ref.set(stateRef, nextState)
        return result
      })

    const createSession: CombatService['createSession'] = (blueprint) =>
      Effect.gen(function* () {
        const session = yield* createCombatSession(blueprint)
        yield* Ref.update(stateRef, (state) => HashMap.set(state, session.id, session))
        return session.id
      })

    const registerCombatant: CombatService['registerCombatant'] = (sessionId, blueprint) =>
      modifySession(sessionId, (session) =>
        Effect.gen(function* () {
          const combatant = yield* createCombatant(blueprint)
          const nextSession = yield* insertCombatant(session, combatant)
          return [combatant, nextSession] satisfies readonly [Combatant, CombatSession]
        })
      )

    const executeAttack: CombatService['executeAttack'] = (sessionId, command) =>
      modifySession(sessionId, (session) =>
        Effect.gen(function* () {
          const randomValue = yield* Random.next
          const roll = yield* makeCriticalChance(randomValue)
          const timestamp = yield* currentTimestamp
          const context: AttackContext = { timestamp, criticalRoll: roll }
          const outcome = yield* resolveAttack(session, command, context)
          return [outcome.event, outcome.session] satisfies readonly [CombatEvent, CombatSession]
        })
      )

    const advanceCooldowns: CombatService['advanceCooldowns'] = (sessionId, elapsedMilliseconds) =>
      Effect.gen(function* () {
        const elapsed = yield* makeCooldown(elapsedMilliseconds)
        const state = yield* Ref.get(stateRef)
        const sessionOption = HashMap.get(state, sessionId)
        const session = yield* pipe(
          sessionOption,
          Option.match({
            onNone: () => Effect.fail(CombatError.sessionNotFound(sessionId)),
            onSome: (s) => Effect.succeed(s),
          })
        )
        const refreshed = yield* Effect.forEach(
          session.combatants,
          (combatant) => decayCooldowns(combatant, elapsed),
          { concurrency: 'unbounded' }
        )
        const nextSession: CombatSession = {
          id: session.id,
          combatants: refreshed,
          timeline: session.timeline,
        }
        const nextState = HashMap.set(state, sessionId, nextSession)
        yield* Ref.set(stateRef, nextState)
      })

    const getCombatant: CombatService['getCombatant'] = (sessionId, combatantId) =>
      getSession(sessionId).pipe(
        Effect.flatMap((session) => {
          const option = ReadonlyArray.findFirst(session.combatants, (combatant) => combatant.id === combatantId)
          return Option.match(option, {
            onNone: () => Effect.fail(CombatError.combatantNotFound(combatantId)),
            onSome: (combatant) => Effect.succeed(combatant),
          })
        })
      )

    const timeline: CombatService['timeline'] = (sessionId) =>
      getSession(sessionId).pipe(Effect.map((session) => session.timeline))

    return CombatServiceTag.of({
      createSession,
      registerCombatant,
      executeAttack,
      advanceCooldowns,
      getCombatant,
      timeline,
    })
  })
)
