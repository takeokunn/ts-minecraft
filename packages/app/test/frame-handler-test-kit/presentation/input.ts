import { Effect, MutableHashSet } from 'effect'
import { InputService } from '@ts-minecraft/presentation/input'

const buildInputService = (
  pressedKeys: MutableHashSet.MutableHashSet<string>,
  consumeMouseClick: (btn: number) => Effect.Effect<boolean>,
  isMouseDown: (btn: number) => Effect.Effect<boolean>,
): InputService =>
  InputService.of({
    _tag: '@minecraft/presentation/InputService' as const,
    consumeKeyPress: (key: string) =>
      Effect.sync(() => {
        if (MutableHashSet.has(pressedKeys, key)) {
          MutableHashSet.remove(pressedKeys, key)
          return true
        }
        return false
      }),
    consumeMouseClick,
    isKeyPressed: (key: string) => Effect.succeed(MutableHashSet.has(pressedKeys, key)),
    getMouseDelta: () => Effect.succeed({ x: 0, y: 0 }),
    isMouseDown,
    requestPointerLock: () => Effect.void,
    exitPointerLock: () => Effect.void,
    isPointerLocked: () => Effect.succeed(false),
    consumeWheelDelta: () => Effect.succeed(0),
  })

/** Creates an input service fake with consumable key presses and inert mouse input. */
export const makeInputService = (pressedKeys: MutableHashSet.MutableHashSet<string> = MutableHashSet.empty()) =>
  buildInputService(pressedKeys, (_btn) => Effect.succeed(false), (_btn) => Effect.succeed(false))

/** Creates an input service fake that fires a single mouse-button click (0 = left, 2 = right). */
export const makeClickInputService = (
  button: number,
  pressedKeys: MutableHashSet.MutableHashSet<string> = MutableHashSet.empty(),
) => buildInputService(pressedKeys, (btn) => Effect.succeed(btn === button), (_btn) => Effect.succeed(false))

/** Creates an input service fake that holds a mouse button down (0 = left). */
export const makeMouseDownInputService = (
  button: number,
  pressedKeys: MutableHashSet.MutableHashSet<string> = MutableHashSet.empty(),
) => buildInputService(pressedKeys, (_btn) => Effect.succeed(false), (btn) => Effect.succeed(btn === button))
