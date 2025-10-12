import { Effect, Layer, Queue, Ref, Stream } from 'effect'
import { ChunkEvent, ChunkSystemError, ChunkSystemRepository, ChunkSystemState } from './index'

const wrapRepository = <A, E>(effect: Effect.Effect<A, E>) =>
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

const simulateLatency = <A, E>(effect: Effect.Effect<A, E>) => effect

export const indexedDbRepositoryLayer = (initial: ChunkSystemState): Layer.Layer<ChunkSystemRepository> =>
  Layer.scoped(
    ChunkSystemRepository,
    Effect.gen(function* () {
      const persistedRef = yield* Ref.make(initial)
      // Queue生成時にacquireReleaseでshutdownを保証
      const eventQueue = yield* Effect.acquireRelease(Queue.unbounded<ChunkEvent>(), (q) => Queue.shutdown(q))
      const observe: Stream.Stream<ChunkEvent, ChunkSystemError> = Stream.fromQueue(eventQueue)
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
