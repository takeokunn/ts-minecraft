import { match } from 'ts-pattern';

// --- Type Definitions ---

export type BrowserInputState = {
  readonly keyboard: ReadonlySet<string>;
  readonly mouse: {
    readonly dx: number;
    readonly dy: number;
  };
  readonly isLocked: boolean;
};

type LockableControls = {
  readonly isLocked: boolean;
  lock: () => void;
  unlock: () => void;
  addEventListener: (type: 'lock' | 'unlock', listener: () => void) => void;
  removeEventListener: (type: 'lock' | 'unlock', listener: () => void) => void;
};

export type InputManager = {
  getState: () => BrowserInputState;
  getMouseDelta: () => { dx: number; dy: number };
  registerListeners: (controls: LockableControls) => void;
  cleanup: () => void;
};

// --- Factory Function ---

export function createInputManager(): InputManager {
  const state = {
    keyboard: new Set<string>(),
    mouse: { dx: 0, dy: 0 },
    isLocked: false,
  };

  let cleanupListeners: (() => void) | null = null;

  const registerListeners = (controls: LockableControls): void => {
    // If listeners are already registered, clean them up first.
    if (cleanupListeners) {
      cleanupListeners();
    }

    const getMouseButtonKey = (button: number) =>
      match(button)
        .with(0, () => 'Mouse0' as const)
        .with(2, () => 'Mouse2' as const)
        .otherwise(() => null);

    const handleMouseButton = (event: MouseEvent, action: 'add' | 'delete') => {
      if (controls.isLocked) {
        const key = getMouseButtonKey(event.button);
        if (key) {
          state.keyboard[action](key);
        }
      }
    };

    const onKeyDown = (event: KeyboardEvent) => state.keyboard.add(event.code);
    const onKeyUp = (event: KeyboardEvent) => state.keyboard.delete(event.code);

    const onMouseMove = (event: MouseEvent) => {
      if (controls.isLocked) {
        state.mouse.dx += event.movementX;
        state.mouse.dy += event.movementY;
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      if (controls.isLocked) {
        handleMouseButton(event, 'add');
      } else {
        controls.lock();
      }
    };

    const onMouseUp = (event: MouseEvent) => handleMouseButton(event, 'delete');

    const onLock = () => { state.isLocked = true; };
    const onUnlock = () => { state.isLocked = false; };

    const listeners: { [K in keyof DocumentEventMap]?: (event: DocumentEventMap[K]) => void } = {
      keydown: onKeyDown,
      keyup: onKeyUp,
      mousemove: onMouseMove,
      mousedown: onMouseDown,
      mouseup: onMouseUp,
    };

    for (const [event, listener] of Object.entries(listeners)) {
      document.addEventListener(event, listener as EventListener);
    }
    controls.addEventListener('lock', onLock);
    controls.addEventListener('unlock', onUnlock);

    cleanupListeners = () => {
      for (const [event, listener] of Object.entries(listeners)) {
        document.removeEventListener(event, listener as EventListener);
      }
      controls.removeEventListener('lock', onLock);
      controls.removeEventListener('unlock', onUnlock);
      if (controls.isLocked) {
        controls.unlock();
      }
      cleanupListeners = null;
    };
  };

  const cleanup = () => {
    if (cleanupListeners) {
      cleanupListeners();
    }
  };

  const getState = (): BrowserInputState => {
    return state;
  };

  const getMouseDelta = (): { dx: number; dy: number } => {
    const delta = { dx: state.mouse.dx, dy: state.mouse.dy };
    state.mouse.dx = 0;
    state.mouse.dy = 0;
    return delta;
  };

  return {
    getState,
    getMouseDelta,
    registerListeners,
    cleanup,
  };
}