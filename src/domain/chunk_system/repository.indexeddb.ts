import { Duration, Effect, Layer, Queue, Ref, Stream } from 'effect'
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

const simulateLatency = <A>(effect: Effect.Effect<A, unknown>) =>
  Effect.sleep(Duration.millis(2)).pipe(Effect.zipRight(effect))

export const indexedDbRepositoryLayer = (initial: ChunkSystemState): Layer.Layer<ChunkSystemRepository> =>
  Layer.scoped(
    ChunkSystemRepository,
    Effect.gen(function* () {
      const persistedRef = yield* Ref.make(initial)
      const eventQueue = yield* Queue.sliding<ChunkEvent>(512)
      const observe: Stream.Stream<ChunkEvent, ChunkSystemError> = Stream.fromQueue(eventQueue)
      yield* Effect.addFinalizer(() => Queue.shutdown(eventQueue))
      return ChunkSystemRepository.of({
        load: wrapRepository(simulateLatency(Ref.get(persistedRef))),
        save: (state, events) =>
          wrapRepository(
            simulateLatency(
              Effect.all([Ref.set(persistedRef, state), broadcastAll(eventQueue, events)], { discard: true })
            )
          ),
        observe,
      })
    })
  )
