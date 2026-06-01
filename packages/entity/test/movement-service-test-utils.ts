import { Effect, Layer, MutableHashMap, MutableHashSet, MutableRef, Option } from 'effect'
import { PlayerInputService } from '@ts-minecraft/entity'
import type { MouseDelta, MovementInput } from '@ts-minecraft/entity'

type TestInputService = PlayerInputService & {
  readonly setKeyPressed: (key: string, pressed: boolean) => void
  readonly setMouseDelta: (delta: MouseDelta) => void
  readonly setPointerLocked: (locked: boolean) => void
}

export const createTestInputService = (
  initialState: Partial<MovementInput & { mouseDelta?: MouseDelta; pointerLocked?: boolean }> = {}
): TestInputService => {
  const pressedKeys = MutableHashMap.make(
    ['KeyW', Option.getOrElse(Option.fromNullable(initialState.forward), () => false)],
    ['KeyS', Option.getOrElse(Option.fromNullable(initialState.backward), () => false)],
    ['KeyA', Option.getOrElse(Option.fromNullable(initialState.left), () => false)],
    ['KeyD', Option.getOrElse(Option.fromNullable(initialState.right), () => false)],
    ['Space', Option.getOrElse(Option.fromNullable(initialState.jump), () => false)],
    ['ControlLeft', Option.getOrElse(Option.fromNullable(initialState.sprint), () => false)],
  )
  const justPressedKeys = MutableHashSet.empty<string>()
  if (initialState.jump) {
    MutableHashSet.add(justPressedKeys, 'Space')
  }
  const mouseDeltaRef = MutableRef.make(
    Option.getOrElse(Option.fromNullable(initialState.mouseDelta), () => ({ x: 0, y: 0 }))
  )
  const pointerLockedRef = MutableRef.make(initialState.pointerLocked ?? true)

  return Object.assign(PlayerInputService.of({
    _tag: '@minecraft/application/PlayerInputService' as const,
    isKeyPressed: (key: string) => Effect.sync(() => Option.getOrElse(MutableHashMap.get(pressedKeys, key), () => false)),
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
    isPointerLocked: () => Effect.sync(() => MutableRef.get(pointerLockedRef)),
    consumeWheelDelta: () => Effect.sync(() => 0),
  }), {
    setKeyPressed: (key: string, pressed: boolean) => {
      MutableHashMap.set(pressedKeys, key, pressed)
    },
    setMouseDelta: (delta: MouseDelta) => {
      MutableRef.set(mouseDeltaRef, delta)
    },
    setPointerLocked: (locked: boolean) => {
      MutableRef.set(pointerLockedRef, locked)
    },
  })
}

export const createTestLayers = (inputService: PlayerInputService) =>
  Layer.succeed(PlayerInputService, inputService)
