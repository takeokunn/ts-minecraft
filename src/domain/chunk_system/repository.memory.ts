import { Effect, Layer, Queue, Ref, Stream } from 'effect'
import { ChunkEvent, ChunkSystemError, ChunkSystemRepository, ChunkSystemState } from './index'

const wrapRepository = <A>(effect: Effect.Effect<A, unknown>) =>
  effect.pipe(
    Effect.mapError((cause) =>
      ChunkSystemError.RepositoryFailure({
        reason: typeof cause === 'string' ? cause : String(cause),
      })
    )
  )

const broadcastAll = (queue: Queue.Queue<ChunkEvent>, events: ReadonlyArray<ChunkEvent>) =>
  Effect.forEach(events, (event) => Queue.offer(queue, event), {
    discard: true,
  })

export const memoryRepositoryLayer = (initial: ChunkSystemState): Layer.Layer<ChunkSystemRepository> =>
  Layer.scoped(
    ChunkSystemRepository,
    Effect.gen(function* () {
      const stateRef = yield* Ref.make(initial)
      const eventQueue = yield* Queue.sliding<ChunkEvent>(512)
      const observe: Stream.Stream<ChunkEvent, ChunkSystemError> = Stream.fromQueue(eventQueue)
      yield* Effect.addFinalizer(() => Queue.shutdown(eventQueue))
      return ChunkSystemRepository.of({
        load: wrapRepository(Ref.get(stateRef)),
        save: (state, events) =>
          wrapRepository(Effect.all([Ref.set(stateRef, state), broadcastAll(eventQueue, events)], { discard: true })),
        observe,
      })
    })
  )
