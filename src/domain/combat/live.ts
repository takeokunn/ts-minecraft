import { Context, Effect, HashMap, Layer, Random, Ref } from 'effect'
import * as ReadonlyArray from 'effect/Array'
import { pipe } from 'effect/Function'
import {
  AttackCommand,
  AttackContext,
  resolveAttack,
  decayCooldowns,
} from './service'
import {
  CombatDomainError,
  CombatEvent,
  CombatantId,
  SessionId,
  currentTimestamp,
  makeCooldown,
  makeCriticalChance,
} from './types'
import {
  CombatSession,
  Combatant,
  CombatSessionBlueprint,
  CombatantBlueprint,
  createCombatant,
  createSession as createCombatSession,
  insertCombatant,
} from './model'
import { CombatError } from './types'

export interface CombatService {
  readonly createSession: (
    blueprint: CombatSessionBlueprint
  ) => Effect.Effect<SessionId, CombatDomainError>
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
  readonly getCombatant: (
    sessionId: SessionId,
    combatantId: CombatantId
  ) => Effect.Effect<Combatant, CombatDomainError>
  readonly timeline: (
    sessionId: SessionId
  ) => Effect.Effect<ReadonlyArray<CombatEvent>, CombatDomainError>
}

export const CombatServiceTag = Context.GenericTag<CombatService>(
  '@domain/combat/CombatService'
)

export const CombatServiceLive = Layer.effect(
  CombatServiceTag,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(HashMap.empty<SessionId, CombatSession>())

    const getSession = (
      sessionId: SessionId
    ): Effect.Effect<CombatSession, CombatDomainError> =>
      Ref.get(stateRef).pipe(
        Effect.flatMap((state) =>
          pipe(
            HashMap.get(state, sessionId),
            Effect.fromOption(() => CombatError.sessionNotFound(sessionId))
          )
        )
      )

    const modifySession = <A>(
      sessionId: SessionId,
      fn: (
        session: CombatSession
      ) => Effect.Effect<readonly [A, CombatSession], CombatDomainError>
    ): Effect.Effect<A, CombatDomainError> =>
      Ref.modifyEffect(stateRef, (state) =>
        pipe(
          HashMap.get(state, sessionId),
          Effect.fromOption(() => CombatError.sessionNotFound(sessionId)),
          Effect.flatMap((session) =>
            fn(session).pipe(
              Effect.map(([result, nextSession]) => {
                const nextState = HashMap.set(state, sessionId, nextSession)
                return [result, nextState] satisfies readonly [
                  A,
                  HashMap.HashMap<SessionId, CombatSession>
                ]
              })
            )
          )
        )
      )

    const createSession: CombatService['createSession'] = (blueprint) =>
      Effect.gen(function* () {
        const session = yield* createCombatSession(blueprint)
        yield* Ref.update(stateRef, (state) => HashMap.set(state, session.id, session))
        return session.id
      })

    const registerCombatant: CombatService['registerCombatant'] = (
      sessionId,
      blueprint
    ) =>
      modifySession(sessionId, (session) =>
        Effect.gen(function* () {
          const combatant = yield* createCombatant(blueprint)
          const nextSession = yield* insertCombatant(session, combatant)
          return [combatant, nextSession] satisfies readonly [Combatant, CombatSession]
        })
      )

    const executeAttack: CombatService['executeAttack'] = (
      sessionId,
      command
    ) =>
      modifySession(sessionId, (session) =>
        Effect.gen(function* () {
          const randomValue = yield* Random.next
          const roll = yield* makeCriticalChance(randomValue)
          const timestamp = yield* currentTimestamp
          const context: AttackContext = { timestamp, criticalRoll: roll }
          const outcome = yield* resolveAttack(session, command, context)
          return [outcome.event, outcome.session] satisfies readonly [
            CombatEvent,
            CombatSession
          ]
        })
      )

    const advanceCooldowns: CombatService['advanceCooldowns'] = (
      sessionId,
      elapsedMilliseconds
    ) =>
      modifySession(sessionId, (session) =>
        Effect.gen(function* () {
          const elapsed = yield* makeCooldown(elapsedMilliseconds)
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
          return [undefined, nextSession] satisfies readonly [void, CombatSession]
        })
      ).pipe(Effect.asVoid)

    const getCombatant: CombatService['getCombatant'] = (sessionId, combatantId) =>
      getSession(sessionId).pipe(
        Effect.flatMap((session) =>
          pipe(
            session.combatants,
            ReadonlyArray.findFirst((combatant) => combatant.id === combatantId),
            Effect.fromOption(() => CombatError.combatantNotFound(combatantId))
          )
        )
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
