
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fc } from '@fast-check/vitest';
import { match, P } from 'ts-pattern';

import { createBrowserInputState, registerInputListeners, getMouseDelta, getKeyboardState } from './input-browser';
import type { BrowserInputState } from '@/domain/types';

// A mock that satisfies the LockableControls type used by the function
const createMockControls = (isLocked = false) => ({
  isLocked,
  lock: vi.fn(),
  unlock: vi.fn(),
});

// Arbitraries for Property-Based Testing
const keyCodeArbitrary = fc.stringMatching(/^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft|ControlLeft|AltLeft)$/);
const mouseButtonArbitrary = fc.constantFrom(0, 2); // 0: Left, 2: Right

describe('infrastructure/input-browser', () => {
  let state: BrowserInputState;
  let controls: ReturnType<typeof createMockControls>;
  let cleanup: () => void;

  beforeEach(() => {
    state = createBrowserInputState();
  });

  afterEach(() => {
    // Ensure cleanup is called after each test to remove listeners
    if (cleanup) {
      cleanup();
    }
  });

  describe('createBrowserInputState()', () => {
    it('should return a state object with correct default values', () => {
      const initialState = createBrowserInputState();
      const keyboardState = getKeyboardState(initialState);

      const result = match(initialState)
        .with({ keyboard: P.instanceOf(Set), mouse: { dx: 0, dy: 0 } }, () => 'valid')
        .otherwise(() => 'invalid');

      expect(result).toBe('valid');
      expect(keyboardState.size).toBe(0);
    });
  });

  describe('registerInputListeners()', () => {
    it('should add key to keyboard set on keydown and remove on keyup', () => {
      fc.assert(
        fc.property(keyCodeArbitrary, keyCode => {
          // Arrange
          state = createBrowserInputState();
          controls = createMockControls(true);
          cleanup = registerInputListeners(state, controls);

          // Act & Assert (keydown)
          document.dispatchEvent(new KeyboardEvent('keydown', { code: keyCode }));
          expect(getKeyboardState(state).has(keyCode)).toBe(true);

          // Act & Assert (keyup)
          document.dispatchEvent(new KeyboardEvent('keyup', { code: keyCode }));
          expect(getKeyboardState(state).has(keyCode)).toBe(false);
        }),
      );
    });

    it('should accumulate mouse delta on mousemove only when pointer is locked', () => {
      fc.assert(
        fc.property(
          fc.array(fc.record({ movementX: fc.integer(), movementY: fc.integer() })),
          fc.boolean(),
          (moves, isLocked) => {
            // Arrange
            state = createBrowserInputState();
            controls = createMockControls(isLocked);
            cleanup = registerInputListeners(state, controls);
            let expectedDx = 0;
            let expectedDy = 0;

            // Act
            for (const move of moves) {
              document.dispatchEvent(new MouseEvent('mousemove', move));
              if (isLocked) {
                expectedDx += move.movementX;
                expectedDy += move.movementY;
              }
            }

            // Assert
            expect(state.mouse.dx).toBe(expectedDx);
            expect(state.mouse.dy).toBe(expectedDy);
          },
        ),
      );
    });

    it('should handle mousedown and mouseup for Mouse0 and Mouse2 when locked', () => {
      fc.assert(
        fc.property(mouseButtonArbitrary, button => {
          // Arrange
          const mouseKey = button === 0 ? 'Mouse0' : 'Mouse2';
          state = createBrowserInputState();
          controls = createMockControls(true);
          cleanup = registerInputListeners(state, controls);

          // Act & Assert (mousedown)
          document.dispatchEvent(new MouseEvent('mousedown', { button }));
          expect(getKeyboardState(state).has(mouseKey)).toBe(true);

          // Act & Assert (mouseup)
          document.dispatchEvent(new MouseEvent('mouseup', { button }));
          expect(getKeyboardState(state).has(mouseKey)).toBe(false);
        }),
      );
    });

    it('should call controls.lock() on mousedown when not locked', () => {
      // Arrange
      controls = createMockControls(false);
      cleanup = registerInputListeners(state, controls);

      // Act
      document.dispatchEvent(new MouseEvent('mousedown'));

      // Assert
      expect(controls.lock).toHaveBeenCalledTimes(1);
    });

    it('cleanup function should remove all registered listeners', () => {
      // Arrange
      controls = createMockControls(true);
      cleanup = registerInputListeners(state, controls);

      // Act: Dispatch an event to confirm listener is active
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
      expect(getKeyboardState(state).has('KeyA')).toBe(true);

      // Act: Call cleanup
      cleanup();

      // Assert: Dispatch events again to confirm listeners are removed
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' }));
      expect(getKeyboardState(state).has('KeyB')).toBe(false);

      document.dispatchEvent(new MouseEvent('mousemove', { movementX: 50, movementY: 50 }));
      expect(state.mouse.dx).toBe(0);
    });

    it('cleanup function should call controls.unlock() only if it was locked', () => {
      fc.assert(
        fc.property(fc.boolean(), isLocked => {
          // Arrange
          controls = createMockControls(isLocked);
          cleanup = registerInputListeners(state, controls);

          // Act
          cleanup();

          // Assert
          if (isLocked) {
            expect(controls.unlock).toHaveBeenCalledTimes(1);
          } else {
            expect(controls.unlock).not.toHaveBeenCalled();
          }
        }),
      );
    });
  });

  describe('getMouseDelta()', () => {
    it('should return the current mouse delta and reset it to zero', () => {
      fc.assert(
        fc.property(fc.integer(), fc.integer(), (dx, dy) => {
          // Arrange
          // Cast to mutable type for test setup, mirroring the implementation
          const mutableMouse = state.mouse as { dx: number; dy: number };
          mutableMouse.dx = dx;
          mutableMouse.dy = dy;

          // Act
          const delta = getMouseDelta(state);

          // Assert
          expect(delta).toEqual({ dx, dy });
          expect(state.mouse).toEqual({ dx: 0, dy: 0 });
        }),
      );
    });
  });

  describe('getKeyboardState()', () => {
    it('should return the current keyboard state', () => {
      fc.assert(
        fc.property(fc.array(keyCodeArbitrary), keyCodes => {
          // Arrange
          state = createBrowserInputState();
          for (const code of keyCodes) {
            // Correctly mutate the set instead of reassigning the readonly property
            (state.keyboard as Set<string>).add(code);
          }

          // Act
          const keyboardState = getKeyboardState(state);

          // Assert
          expect(keyboardState).toBe(state.keyboard);
          expect(keyboardState.size).toBe(new Set(keyCodes).size);
          for (const code of keyCodes) {
            expect(keyboardState.has(code)).toBe(true);
          }
        }),
      );
    });
  });
});
