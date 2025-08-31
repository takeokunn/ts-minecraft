import { Effect, Layer, Ref } from 'effect';
import { match } from 'ts-pattern';
import type { InputState } from '../domain/components';
import { PlayerSchema } from '../domain/components';
import { GameState } from '../runtime/game-state';
import type { GameState as GameStateType } from '../runtime/game-state';
import { Input } from '../runtime/services';
import type { Input as InputType } from '../runtime/services';
import { query, updateComponent } from '../runtime/world';
import type { World } from '../runtime/world';
import { ThreeJsContext } from './renderer-three';

type KeyState = Omit<InputState, '_tag'>;
type MouseState = {
  dx: number;
  dy: number;
  leftClick: boolean;
  rightClick: boolean;
};

const makeInput: Effect.Effect<
  InputType,
  never,
  GameStateType | World | ThreeJsContext
> = Effect.gen(function* (_) {
  const gameState: GameStateType = yield* _(GameState);
  const { controls } = yield* _(ThreeJsContext);

  const keyStateRef: Ref.Ref<KeyState> = yield* _(
    Ref.make<KeyState>({
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      place: false,
    }),
  );
  const mouseStateRef: Ref.Ref<MouseState> = yield* _(
    Ref.make<MouseState>({
      dx: 0,
      dy: 0,
      leftClick: false,
      rightClick: false,
    }),
  );

  // --- Event Listeners ---
  const onKeyDown = (event: KeyboardEvent): void => {
    let lastWPress: number = 0;
    const sprintThreshold: number = 300; // ms

    const effect: Effect.Effect<void> = match(event.code)
      .with('KeyW', () =>
        Ref.update(keyStateRef, (s: KeyState) => {
          const now = performance.now();
          const isSprinting = now - lastWPress < sprintThreshold;
          lastWPress = now;
          return { ...s, forward: true, sprint: isSprinting };
        }),
      )
      .with('KeyS', () =>
        Ref.update(keyStateRef, (s: KeyState) => ({ ...s, backward: true })),
      )
      .with('KeyA', () =>
        Ref.update(keyStateRef, (s: KeyState) => ({ ...s, left: true })),
      )
      .with('KeyD', () =>
        Ref.update(keyStateRef, (s: KeyState) => ({ ...s, right: true })),
      )
      .with('Space', () =>
        Ref.update(keyStateRef, (s: KeyState) => ({ ...s, jump: true })),
      )
      .with('KeyQ', () =>
        Ref.update(keyStateRef, (s: KeyState) => ({ ...s, place: true })),
      )
      .with('Digit1', () => Effect.sync(() => gameState.setSelectedSlot(0)))
      .with('Digit2', () => Effect.sync(() => gameState.setSelectedSlot(1)))
      .with('Digit3', () => Effect.sync(() => gameState.setSelectedSlot(2)))
      .with('Digit4', () => Effect.sync(() => gameState.setSelectedSlot(3)))
      .with('Digit5', () => Effect.sync(() => gameState.setSelectedSlot(4)))
      .with('Digit6', () => Effect.sync(() => gameState.setSelectedSlot(5)))
      .with('Digit7', () => Effect.sync(() => gameState.setSelectedSlot(6)))
      .with('Digit8', () => Effect.sync(() => gameState.setSelectedSlot(7)))
      .with('Digit9', () => Effect.sync(() => gameState.setSelectedSlot(8)))
      .otherwise(() => Effect.void);
    Effect.runFork(effect);
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    const effect: Effect.Effect<void> = match(event.code)
      .with('KeyW', () =>
        Ref.update(keyStateRef, (s: KeyState) => ({
          ...s,
          forward: false,
          sprint: false,
        })),
      )
      .with('KeyS', () =>
        Ref.update(keyStateRef, (s: KeyState) => ({ ...s, backward: false })),
      )
      .with('KeyA', () =>
        Ref.update(keyStateRef, (s: KeyState) => ({ ...s, left: false })),
      )
      .with('KeyD', () =>
        Ref.update(keyStateRef, (s: KeyState) => ({ ...s, right: false })),
      )
      .with('Space', () =>
        Ref.update(keyStateRef, (s: KeyState) => ({ ...s, jump: false })),
      )
      .with('KeyQ', () =>
        Ref.update(keyStateRef, (s: KeyState) => ({ ...s, place: false })),
      )
      .otherwise(() => Effect.void);
    Effect.runFork(effect);
  };

  const onMouseMove = (event: MouseEvent): void => {
    if (controls.isLocked) {
      Effect.runFork(
        Ref.update(mouseStateRef, (s: MouseState) => ({
          ...s,
          dx: s.dx + event.movementX,
          dy: s.dy + event.movementY,
        })),
      );
    }
  };

  const onMouseDown = (event: MouseEvent): void => {
    if (controls.isLocked) {
      if (event.button === 0) {
        // Left click
        Effect.runFork(
          Ref.update(mouseStateRef, (s: MouseState) => ({
            ...s,
            leftClick: true,
          })),
        );
      }
      if (event.button === 2) {
        // Right click
        Effect.runFork(
          Ref.update(mouseStateRef, (s: MouseState) => ({
            ...s,
            rightClick: true,
          })),
        );
      }
    }
  };

  const escapeScreen = document.getElementById('escapeScreenGUI');

  const onPointerLockChange = (): void => {
    if (controls.isLocked) {
      if (escapeScreen) escapeScreen.style.display = 'none';
    } else {
      if (escapeScreen) escapeScreen.style.display = 'block';
    }
  };

  controls.addEventListener('lock', onPointerLockChange);
  controls.addEventListener('unlock', onPointerLockChange);

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mousedown', onMouseDown);

  yield* _(
    Effect.addFinalizer(() =>
      Effect.sync(() => {
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mousedown', onMouseDown);
        controls.removeEventListener('lock', onPointerLockChange);
        controls.removeEventListener('unlock', onPointerLockChange);
        controls.unlock();
      }),
    ),
  );

  // --- Poll Method ---
  const poll: Effect.Effect<void, never, World> = Effect.gen(function* (_) {
    const playerEntity = (yield* _(query(PlayerSchema)))[0];
    if (!playerEntity || !controls.isLocked) {
      return;
    }

    // Sync keyboard state
    const keyState: KeyState = yield* _(Ref.get(keyStateRef));
    yield* _(
      updateComponent(playerEntity.id, {
        _tag: 'InputState',
        ...keyState,
      }),
    );
  });

  // Expose a method to get the mouse state for other systems
  const getMouseState: Effect.Effect<MouseState, never, never> = Ref.getAndSet(
    mouseStateRef,
    {
      dx: 0,
      dy: 0,
      leftClick: false,
      rightClick: false,
    },
  );

  return Input.of({
    poll: () => poll,
    getMouseState: () => getMouseState,
  });
});

export const InputLive: Layer.Layer<
  InputType,
  never,
  GameStateType | World | ThreeJsContext
> = Layer.scoped(Input, makeInput);
