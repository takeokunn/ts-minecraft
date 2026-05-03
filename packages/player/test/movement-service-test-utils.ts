import { Effect, Layer, MutableHashMap, MutableHashSet, Option } from 'effect'
import { PlayerInputService } from '@ts-minecraft/player'
import type { InputServicePort as InputServiceType } from '@ts-minecraft/player'
import type { MovementInput } from '@ts-minecraft/player'

export const createTestInputService = (
  initialState: Partial<MovementInput> = {}
): InputServiceType & { setKeyPressed: (key: string, pressed: boolean) => void } => {
  const pressedKeys = MutableHashMap.make(
    ['KeyW', Option.getOrElse(Option.fromNullable(initialState.forward), () => false)],
    ['KeyS', Option.getOrElse(Option.fromNullable(initialState.backward), () => false)],
    ['KeyA', Option.getOrElse(Option.fromNullable(initialState.left), () => false)],
    ['KeyD', Option.getOrElse(Option.fromNullable(initialState.right), () => false)],
    ['Space', Option.getOrElse(Option.fromNullable(initialState.jump), () => false)],
    ['ControlLeft', Option.getOrElse(Option.fromNullable(initialState.sprint), () => false)],
  )
  // For consumeKeyPress, track "just pressed" keys
  // In tests, jump=true means Space was just pressed
  const justPressedKeys = MutableHashSet.empty<string>()
  if (initialState.jump) {
    MutableHashSet.add(justPressedKeys, 'Space')
  }

  return {
    isKeyPressed: (key: string) => Effect.sync(() => Option.getOrElse(MutableHashMap.get(pressedKeys, key), () => false)),
    consumeKeyPress: (key: string) =>
      Effect.sync(() => {
        if (MutableHashSet.has(justPressedKeys, key)) {
          MutableHashSet.remove(justPressedKeys, key)
          return true
        }
        return false
      }),
    getMouseDelta: () => Effect.sync(() => ({ x: 0, y: 0 })),
    isMouseDown: () => Effect.sync(() => false),
    requestPointerLock: () => Effect.sync(() => {}),
    exitPointerLock: () => Effect.sync(() => {}),
    isPointerLocked: () => Effect.sync(() => true),
    consumeMouseClick: () => Effect.sync(() => false),
    consumeWheelDelta: () => Effect.sync(() => 0),
    setKeyPressed: (key: string, pressed: boolean) => {
      MutableHashMap.set(pressedKeys, key, pressed)
    },
  } as unknown as InputServiceType & { setKeyPressed: (key: string, pressed: boolean) => void }
}

export const createTestLayers = (inputService: InputServiceType) =>
  Layer.succeed(PlayerInputService, inputService as unknown as PlayerInputService)
