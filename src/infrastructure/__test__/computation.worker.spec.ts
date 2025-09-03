import { Effect, Layer, Hub, Deferred } from 'effect'
import { describe, it, assert } from '@effect/vitest'
import { ComputationWorker } from '@/runtime/services'

type Message = {
  type: 'chunkGenerated'
  chunkX: number
  chunkZ: number
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
  indices: Uint32Array
  blocks: unknown[]
}

const ComputationWorkerTest = Layer.effect(
  ComputationWorker,
  Effect.gen(function* (_) {
    const messageHub = yield* _(Hub.unbounded<Message>())

    const postTask = (task: { type: 'generateChunk'; chunkX: number; chunkZ: number }) =>
      Hub.publish(messageHub, {
        type: 'chunkGenerated',
        chunkX: task.chunkX,
        chunkZ: task.chunkZ,
        positions: new Float32Array(),
        normals: new Float32Array(),
        uvs: new Float32Array(),
        indices: new Uint32Array(),
        blocks: [],
      })

    const onMessage = (handler: (message: Message) => Effect.Effect<void>) =>
      Hub.subscribe(messageHub).pipe(
        Effect.flatMap((subscription) =>
          Effect.forever(
            subscription.take.pipe(
              Effect.flatMap(handler),
              Effect.catchAll((error) => Effect.logError(error)),
            ),
          ),
        ),
        Effect.forkScoped,
        Effect.void,
      )

    return ComputationWorker.of({
      postTask,
      onMessage,
    })
  }),
)

describe('ComputationWorker', () => {
  it.effect('should post a task and receive a message', () =>
    Effect.gen(function* (_) {
      const worker = yield* _(ComputationWorker)
      const result = yield* _(Deferred.make<void, never>())

      yield* _(
        worker.onMessage((msg) =>
          Effect.sync(() => {
            assert.deepStrictEqual(msg, {
              type: 'chunkGenerated',
              chunkX: 0,
              chunkZ: 0,
              positions: new Float32Array(),
              normals: new Float32Array(),
              uvs: new Float32Array(),
              indices: new Uint32Array(),
              blocks: [],
            })
            Deferred.succeed(result, Effect.void)
          }),
        ),
      )

      yield* _(worker.postTask({ type: 'generateChunk', chunkX: 0, chunkZ: 0 }))

      yield* _(Deferred.await(result))
    }).pipe(Effect.provide(ComputationWorkerTest)))
})
