import { Context, Effect, Layer, pipe } from 'effect'
import { PlayerErrorBuilders } from './index'
import {
  applyCommand,
  createPlayer,
  snapshot as createSnapshot,
  regenerateHunger,
  transitionState,
  updatePosition,
} from './index'
import { PlayerRepository } from './index'
import { PlayerClock } from './index'
import {
  PlayerAggregate,
  PlayerCommand,
  PlayerCreationInput,
  PlayerGameMode,
  PlayerId,
  PlayerLifecycleState,
  PlayerPosition,
  PlayerSnapshot,
  PlayerUpdateContext,
} from './index'

type ConstraintError = ReturnType<typeof PlayerErrorBuilders.constraint>
type TransitionError = ReturnType<typeof PlayerErrorBuilders.invalidTransition>
type MissingError = ReturnType<typeof PlayerErrorBuilders.missing>
type ClockError = ReturnType<typeof PlayerErrorBuilders.clock>

export interface SpawnInput {
  readonly id: PlayerCreationInput['id']
  readonly name: PlayerCreationInput['name']
  readonly gameMode: PlayerGameMode
  readonly position: PlayerPosition
  readonly timestamp?: number
}

export interface PlayerDomainService {
  readonly spawn: (input: SpawnInput) => Effect.Effect<PlayerAggregate, ConstraintError | ClockError>
  readonly issueCommand: (
    command: PlayerCommand
  ) => Effect.Effect<PlayerAggregate, ConstraintError | TransitionError | MissingError>
  readonly tickRegeneration: (
    id: PlayerId,
    context?: Partial<PlayerUpdateContext>
  ) => Effect.Effect<PlayerAggregate, ConstraintError | MissingError | ClockError>
  readonly relocate: (
    id: PlayerId,
    position: PlayerPosition,
    context?: Partial<PlayerUpdateContext>
  ) => Effect.Effect<PlayerAggregate, ConstraintError | MissingError | ClockError>
  readonly changeState: (
    id: PlayerId,
    to: PlayerLifecycleState,
    context?: Partial<PlayerUpdateContext>
  ) => Effect.Effect<PlayerAggregate, ConstraintError | TransitionError | MissingError | ClockError>
  readonly snapshot: (id: PlayerId) => Effect.Effect<PlayerSnapshot, ConstraintError | MissingError | ClockError>
  readonly list: Effect.Effect<ReadonlyArray<PlayerAggregate>, never>
}

export const PlayerDomainService = Context.Tag<PlayerDomainService>('@domain/player/service')

const makeService = Effect.gen(function* () {
  const repository = yield* PlayerRepository
  const clock = yield* PlayerClock

  const resolveTimestamp = (override?: number) =>
    pipe(
      override,
      Effect.succeed,
      Effect.flatMap((value) => (value === undefined ? clock.current : clock.fromUnix(value)))
    )

  const spawn: PlayerDomainService['spawn'] = (input) =>
    Effect.gen(function* () {
      const timestamp = yield* resolveTimestamp(input.timestamp)
      const creationInput: PlayerCreationInput = {
        id: input.id,
        name: input.name,
        gameMode: input.gameMode,
        position: input.position,
        timestamp,
      }
      const result = yield* createPlayer(creationInput)
      yield* repository.upsert(result.aggregate)
      return result.aggregate
    })

  const issueCommand: PlayerDomainService['issueCommand'] = (command) =>
    Effect.gen(function* () {
      const aggregate = yield* repository.findById(command.id)
      const result = yield* applyCommand(aggregate, command)
      yield* repository.upsert(result.aggregate)
      return result.aggregate
    })

  const tickRegeneration: PlayerDomainService['tickRegeneration'] = (id, context = {}) =>
    Effect.gen(function* () {
      const aggregate = yield* repository.findById(id)
      const timestamp = yield* resolveTimestamp(context.timestamp)
      const result = yield* regenerateHunger(aggregate, { timestamp })
      yield* repository.upsert(result.aggregate)
      return result.aggregate
    })

  const relocate: PlayerDomainService['relocate'] = (id, position, context = {}) =>
    Effect.gen(function* () {
      const aggregate = yield* repository.findById(id)
      const timestamp = yield* resolveTimestamp(context.timestamp)
      const result = yield* updatePosition(aggregate, { position, motion: aggregate.motion }, { timestamp })
      yield* repository.upsert(result.aggregate)
      return result.aggregate
    })

  const changeState: PlayerDomainService['changeState'] = (id, to, context = {}) =>
    Effect.gen(function* () {
      const aggregate = yield* repository.findById(id)
      const timestamp = yield* resolveTimestamp(context.timestamp)
      const result = yield* transitionState(aggregate, to, { timestamp }, `${aggregate.state}->${to}`)
      yield* repository.upsert(result.aggregate)
      return result.aggregate
    })

  const snapshot: PlayerDomainService['snapshot'] = (id) =>
    Effect.gen(function* () {
      const aggregate = yield* repository.findById(id)
      const timestamp = yield* clock.current
      return yield* createSnapshot(aggregate, timestamp)
    })

  const list: PlayerDomainService['list'] = repository.list

  return {
    spawn,
    issueCommand,
    tickRegeneration,
    relocate,
    changeState,
    snapshot,
    list,
  } satisfies PlayerDomainService
})

export const PlayerDomainServiceLive = Layer.effect(PlayerDomainService, makeService)
