import { Layer, MutableHashMap, MutableHashSet, MutableRef, Option, Effect } from 'effect'
import { InputService } from '@ts-minecraft/app/presentation/input/input-service'
import type { InputService as InputServiceType } from '@ts-minecraft/app/presentation/input/input-service'

export const createTestInputService = (initialState: {
  pressedKeys?: MutableHashSet.MutableHashSet<string>
  justPressedKeys?: MutableHashSet.MutableHashSet<string>
  mouseButtons?: MutableHashMap.MutableHashMap<number, boolean>
  mouseDelta?: { x: number; y: number }
  pointerLocked?: boolean
  } = {}): InputServiceType => {
  const pressedKeys = Option.getOrElse(Option.fromNullable(initialState.pressedKeys), () => MutableHashSet.empty<string>())
  const justPressedKeys = Option.getOrElse(Option.fromNullable(initialState.justPressedKeys), () => MutableHashSet.empty<string>())
  const mouseButtons = Option.getOrElse(Option.fromNullable(initialState.mouseButtons), () => MutableHashMap.empty<number, boolean>())
  const mouseDeltaRef = MutableRef.make(Option.getOrElse(Option.fromNullable(initialState.mouseDelta), () => ({ x: 0, y: 0 })))
  const pointerLockedRef = MutableRef.make(Option.getOrElse(Option.fromNullable(initialState.pointerLocked), () => false))

  return {
    _tag: '@minecraft/presentation/InputService' as const,

    isKeyPressed: (key: string) =>
      Effect.sync(() => MutableHashSet.has(pressedKeys, key)),

    consumeKeyPress: (key: string) =>
      Effect.sync(() => {
        if (MutableHashSet.has(justPressedKeys, key)) {
          MutableHashSet.remove(justPressedKeys, key)
          return true
        }
        return false
      }),

    getMouseDelta: () =>
      Effect.sync(() => {
        const delta = { ...MutableRef.get(mouseDeltaRef) }
        MutableRef.set(mouseDeltaRef, { x: 0, y: 0 })
        return delta
      }),

    isMouseDown: (button: number) =>
      Effect.sync(() => Option.getOrElse(MutableHashMap.get(mouseButtons, button), () => false)),

    requestPointerLock: () =>
      Effect.sync(() => {
        MutableRef.set(pointerLockedRef, true)
      }),

    exitPointerLock: () =>
      Effect.sync(() => {
        MutableRef.set(pointerLockedRef, false)
      }),

    isPointerLocked: () =>
      Effect.sync(() => MutableRef.get(pointerLockedRef)),

    consumeMouseClick: () => Effect.sync(() => false),

    consumeWheelDelta: () => Effect.sync(() => 0),
  }
}

export const createTestLayer = (service: InputServiceType) =>
  Layer.succeed(InputService, service)
