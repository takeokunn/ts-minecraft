import { expect, it, layer } from '@effect/vitest'
import { Duration, Effect, Match, Ref, pipe } from 'effect'
import { InputService } from '../input-service'
import { InputServiceLive } from '../input-service-live'
import { InputTimestamp, KeyCode, MouseButton, Vector2 } from '../model'

const waitUntil = (predicate: Effect.Effect<boolean>): Effect.Effect<void> =>
  Effect.gen(function* () {
    const satisfied = yield* predicate
    return yield* pipe(
      satisfied,
      Match.value,
      Match.when(true, () => Effect.void),
      Match.orElse(() =>
        Effect.sleep(Duration.millis(1)).pipe(Effect.flatMap(() => waitUntil(predicate)))
      )
    )
  })

layer(InputServiceLive)('InputServiceLive', (it) => {
  it.effect('updates snapshot via ingest', () =>
    Effect.gen(function* () {
      const service = yield* InputService
      const key = KeyCode('KeyW')
      yield* service.ingest({ _tag: 'KeyPressed', key, timestamp: InputTimestamp(1) })
      yield* waitUntil(service.isKeyPressed(key))
      const pressed = yield* service.isKeyPressed(key)
      expect(pressed).toBe(true)
    })
  )

  it.effect('invokes registered handlers', () =>
    Effect.gen(function* () {
      const service = yield* InputService
      const counter = yield* Ref.make(0)
      yield* service.bindAction((_event, _snapshot) =>
        Ref.update(counter, (value) => value + 1).pipe(Effect.asVoid)
      )
      yield* service.ingest({
        _tag: 'MouseButtonPressed',
        button: MouseButton('left'),
        timestamp: InputTimestamp(2),
      })
      yield* waitUntil(Ref.get(counter).pipe(Effect.map((value) => value > 0)))
      const handled = yield* Ref.get(counter)
      expect(handled).toBeGreaterThan(0)
    })
  )

  it.effect('tracks mouse delta updates', () =>
    Effect.gen(function* () {
      const service = yield* InputService
      const delta = { x: 4, y: -3 }
      yield* service.ingest({
        _tag: 'MouseMoved',
        position: Vector2({ x: 10, y: 20 }),
        delta,
        timestamp: InputTimestamp(3),
      })
      yield* waitUntil(
        service.latestMouseDelta().pipe(
          Effect.map((latest) => latest.deltaX === delta.x && latest.deltaY === delta.y)
        )
      )
      const latest = yield* service.latestMouseDelta()
      expect(latest.deltaX).toBe(delta.x)
      expect(latest.deltaY).toBe(delta.y)
    })
  )
})
