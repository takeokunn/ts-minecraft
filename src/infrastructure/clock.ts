import { Clock } from '@/runtime/services'
import { Console, Effect, Layer, Ref } from 'effect'
import * as THREE from 'three'

export const tick = (
  getDelta: () => number,
  deltaTime: Ref.Ref<number>,
  onFrameCallbacks: Ref.Ref<ReadonlyArray<() => Effect.Effect<void>>>,
) =>
  Effect.gen(function* (_) {
    const delta = getDelta()
    yield* _(Ref.set(deltaTime, delta))
    const callbacks = yield* _(Ref.get(onFrameCallbacks))
    yield* _(
      Effect.forEach(callbacks, (cb) => Effect.catchAll(cb(), (e) => Console.error(e)), {
        discard: true,
        concurrency: 'inherit',
      }),
    )
  })

export const ClockLive = Layer.scoped(
  Clock,
  Effect.gen(function* (_) {
    const clock = new THREE.Clock()
    const deltaTime = yield* _(Ref.make(0))
    const onFrameCallbacks = yield* _(Ref.make<ReadonlyArray<() => Effect.Effect<void>>>([]))

    const onFrame = (callback: () => Effect.Effect<void>) =>
      Ref.update(onFrameCallbacks, (callbacks) => [...callbacks, callback])

    const tickEffect = tick(
      () => clock.getDelta(),
      deltaTime,
      onFrameCallbacks,
    )

    const requestAnimationFrameEffect = Effect.async<void>((resume) => {
      requestAnimationFrame(() => resume(Effect.void))
    })

    const loop = Effect.forever(Effect.flatMap(requestAnimationFrameEffect, () => tickEffect))

    yield* _(Effect.forkScoped(loop))

    return Clock.of({
      deltaTime,
      onFrame,
    })
  }),
)
