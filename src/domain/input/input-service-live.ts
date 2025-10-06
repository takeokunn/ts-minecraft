import { Clock, Effect, Layer, Ref } from 'effect'
import {
  applyEvent,
  InputService,
  InputTimestamp,
  isKeyActive,
  isMouseButtonActive,
  makeSnapshot,
  type InputEvent,
  type InputEventHandler,
  type InputSnapshot,
  type KeyCode,
  type MouseButton,
} from './index'

const makeInputServiceLive = Effect.gen(function* () {
  const now = yield* Effect.map(Clock.currentTimeMillis, (millis) => InputTimestamp(Math.floor(millis)))

  const snapshotRef = yield* Ref.make(makeSnapshot(now))
  const handlersRef = yield* Ref.make<ReadonlyArray<InputEventHandler>>([])

  const runHandlers = (event: InputEvent, snapshot: InputSnapshot) =>
    Ref.get(handlersRef).pipe(
      Effect.flatMap((handlers) => Effect.forEach(handlers, (handler) => handler(event, snapshot), { discard: true }))
    )

  const updateState = (event: InputEvent) => Ref.updateAndGet(snapshotRef, (snapshot) => applyEvent(snapshot, event))

  const ingest = (event: InputEvent) =>
    updateState(event).pipe(
      Effect.flatMap((updated) => runHandlers(event, updated)),
      Effect.asVoid
    )

  const readSnapshot = () => Ref.get(snapshotRef)

  const service = InputService.of({
    ingest,
    currentSnapshot: readSnapshot,
    isKeyPressed: (key: KeyCode) => readSnapshot().pipe(Effect.map((snapshot) => isKeyActive(snapshot, key))),
    isMousePressed: (button: MouseButton) =>
      readSnapshot().pipe(Effect.map((snapshot) => isMouseButtonActive(snapshot, button))),
    latestMouseDelta: () => readSnapshot().pipe(Effect.map((snapshot) => snapshot.mouseDelta)),
    bindAction: (handler: InputEventHandler) =>
      Ref.update(handlersRef, (handlers) => [...handlers, handler]).pipe(Effect.asVoid),
  })

  return service
})

export const InputServiceLive = Layer.effect(InputService, makeInputServiceLive)
