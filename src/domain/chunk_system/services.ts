import { Context, Effect, Layer, Ref, Stream } from 'effect'
import {
  applyCommand,
  ChunkCommand,
  ChunkEvent,
  ChunkSystemConfig,
  ChunkSystemError,
  ChunkSystemRepository,
  ChunkSystemState,
  makeInitialState,
  TransitionResult,
} from './index'

export interface ChunkSystemService {
  readonly current: Effect.Effect<ChunkSystemState, ChunkSystemError>
  readonly dispatch: (command: ChunkCommand) => Effect.Effect<TransitionResult, ChunkSystemError>
  readonly events: Stream.Stream<ChunkEvent, ChunkSystemError>
}

export const ChunkSystemService = Context.GenericTag<ChunkSystemService>('@minecraft/domain/chunk_system/ChunkSystemService')

const createService = (
  config: ChunkSystemConfig
): Effect.Effect<ChunkSystemService, ChunkSystemError, ChunkSystemRepository> =>
  Effect.gen(function* () {
    const repository = yield* ChunkSystemRepository
    const initialState = yield* repository.load.pipe(Effect.orElse(() => makeInitialState(config)))
    const stateRef = yield* Ref.make(initialState)
    const persist = (result: TransitionResult) =>
      repository.save(result.state, result.events).pipe(Effect.zipRight(Ref.set(stateRef, result.state)))
    const dispatch = (command: ChunkCommand) =>
      stateRef.pipe(
        Ref.get,
        Effect.flatMap((state) => applyCommand(state, command)),
        Effect.tap(persist)
      )
    return ChunkSystemService.of({
      current: Ref.get(stateRef),
      dispatch,
      events: repository.observe,
    })
  })

export const chunkSystemLayer = (
  config: ChunkSystemConfig
): Layer.Layer<ChunkSystemService, ChunkSystemError, ChunkSystemRepository> =>
  Layer.effect(ChunkSystemService, createService(config))
