import { Layer, Effect, Ref, Clock } from 'effect'
import { InputService, type InputEventHandler } from './InputService'
import { applyEvent, isKeyActive, isMouseButtonActive, makeSnapshot, type InputSnapshot } from './state'
import { InputTimestamp, type InputEvent, type KeyCode, type MouseButton } from './model'

const makeInputServiceLive = Effect.gen(function* () {
  const now = yield* Clock.currentTimeMillis.pipe(
    Effect.map((millis) => InputTimestamp(Math.floor(millis)))
  )

  const snapshotRef = yield* Ref.make(makeSnapshot(now))
  const handlersRef = yield* Ref.make<ReadonlyArray<InputEventHandler>>([])

  const runHandlers = (event: InputEvent, snapshot: InputSnapshot) =>
    Ref.get(handlersRef).pipe(
      Effect.flatMap((handlers) =>
        Effect.forEach(handlers, (handler) => handler(event, snapshot), { discard: true })
      )
    )

  const updateState = (event: InputEvent) =>
    Ref.updateAndGet(snapshotRef, (snapshot) => applyEvent(snapshot, event))

  const ingest = (event: InputEvent) =>
    updateState(event).pipe(Effect.flatMap((updated) => runHandlers(event, updated)), Effect.asVoid)

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
