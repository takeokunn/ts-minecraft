
import { match } from 'ts-pattern';
import type { BrowserInputState } from '@/domain/types';

// The PointerLockControls interface is complex, but we only need a small subset of its properties.
// This type definition allows us to use a mock or a real instance without `any`.
type LockableControls = {
  isLocked: boolean;
  lock: () => void;
  unlock: () => void;
};

/**
 * Creates an initial, empty state for browser input.
 */
export function createBrowserInputState(): BrowserInputState {
  return {
    keyboard: new Set(),
    mouse: {
      dx: 0,
      dy: 0,
    },
  };
}

type EventListenerPair = [string, (event: any) => void];

/**
 * Registers DOM event listeners to update the input state.
 * @param state The input state object to be mutated.
 * @param controls A PointerLockControls-like object to manage mouse lock.
 * @returns A cleanup function that removes all registered listeners.
 */
export function registerInputListeners(state: BrowserInputState, controls: LockableControls): () => void {
  // The state object is defined as readonly, but this module is responsible for mutating it.
  // We cast to a mutable type here to reflect this responsibility.
  const mutableMouse = state.mouse as { dx: number; dy: number };
  const mutableKeyboard = state.keyboard as Set<string>;

  const getMouseButtonKey = (button: number): string | null =>
    match(button)
      .with(0, () => 'Mouse0') // Left click
      .with(2, () => 'Mouse2') // Right click
      .otherwise(() => null);

  const handleMouseEvent = (event: MouseEvent, action: 'add' | 'delete') => {
    if (controls.isLocked) {
      const key = getMouseButtonKey(event.button);
      if (key) {
        mutableKeyboard[action](key);
      }
    }
  };

  const onKeyDown = (event: KeyboardEvent) => mutableKeyboard.add(event.code);
  const onKeyUp = (event: KeyboardEvent) => mutableKeyboard.delete(event.code);

  const onMouseMove = (event: MouseEvent) => {
    if (controls.isLocked) {
      mutableMouse.dx += event.movementX;
      mutableMouse.dy += event.movementY;
    }
  };

  const onMouseDown = (event: MouseEvent) =>
    match(controls.isLocked)
      .with(true, () => handleMouseEvent(event, 'add'))
      .otherwise(() => controls.lock());

  const onMouseUp = (event: MouseEvent) => handleMouseEvent(event, 'delete');

  const listeners: EventListenerPair[] = [
    ['keydown', onKeyDown],
    ['keyup', onKeyUp],
    ['mousemove', onMouseMove],
    ['mousedown', onMouseDown],
    ['mouseup', onMouseUp],
  ];

  listeners.forEach(([event, listener]) => {
    document.addEventListener(event, listener);
  });

  return () => {
    listeners.forEach(([event, listener]) => {
      document.removeEventListener(event, listener);
    });
    if (controls.isLocked) {
      controls.unlock();
    }
  };
}

/**
 * Returns the accumulated mouse delta since the last call and resets it.
 * @param state The input state object.
 * @returns The mouse delta { dx, dy }.
 */
export function getMouseDelta(state: BrowserInputState): { dx: number; dy: number } {
  const mutableMouse = state.mouse as { dx: number; dy: number };
  const delta = { dx: mutableMouse.dx, dy: mutableMouse.dy };
  mutableMouse.dx = 0;
  mutableMouse.dy = 0;
  return delta;
}

/**
 * Returns the current set of pressed keys.
 * @param state The input state object.
 * @returns A readonly set of key codes.
 */
export function getKeyboardState(state: BrowserInputState): ReadonlySet<string> {
  return state.keyboard;
}
