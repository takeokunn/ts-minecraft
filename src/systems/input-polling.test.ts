
import { Effect, Layer } from 'effect';
import {
  mapInputToState,
  inputPollingSystem,
  keyMap,
} from './input-polling';
import { World } from '@/runtime/world';
import { EntityId } from '@/domain/entity';
import { fc } from '@fast-check/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Input } from '@/domain/types';
import { DeepPartial } from 'vitest';
import { Queries } from '@/domain/queries';

const createMockWorld = (
  overrides: DeepPartial<World> = {},
): World => {
  const playerEid = 1 as EntityId;

  const defaultWorld: World = {
    entities: new Set([playerEid]),
    queries: Queries,
    globalState: {
      isPaused: false,
      player: {
        id: playerEid,
      },
      ...overrides.globalState,
    },
    ...overrides,
    components: {
      player: new Map([[playerEid, { isGrounded: true }]]),
      inputState: new Map(),
      ...overrides.components,
    },
  };

  return defaultWorld as World;
};

const keyStateArbitrary = fc
  .subarray(Object.values(keyMap))
  .map((keys) => new Set(keys));

describe('systems/input-polling', () => {
  describe('mapInputToState', () => {
    it('should correctly map keyboard state to inputState component', () => {
      fc.assert(
        fc.property(keyStateArbitrary, (pressedKeys) => {
          const inputState = mapInputToState(pressedKeys);

          const expectedInputState = {
            forward: pressedKeys.has(keyMap.forward),
            backward: pressedKeys.has(keyMap.backward),
            left: pressedKeys.has(keyMap.left),
            right: pressedKeys.has(keyMap.right),
            jump: pressedKeys.has(keyMap.jump),
            sprint: pressedKeys.has(keyMap.sprint),
            destroy: pressedKeys.has(keyMap.destroy),
            place: pressedKeys.has(keyMap.place),
          };

          expect(inputState).toEqual(expectedInputState);
        }),
      );
    });
  });

  describe('inputPollingSystem', () => {
    const mockInput: Input = {
      getKeyboardState: vi.fn(),
      getMouseDelta: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should update the inputState component for the player', async () => {
      await fc.assert(
        fc.asyncProperty(keyStateArbitrary, async (pressedKeys) => {
          vi.clearAllMocks();

          const world = createMockWorld();
          (
            mockInput.getKeyboardState as vi.Mock
          ).mockReturnValue(pressedKeys);

          const run = Effect.provide(
            inputPollingSystem,
            Layer.mergeAll(
              Layer.succeed(World, world),
              Layer.succeed(Input, mockInput),
            ),
          );

          await Effect.runPromise(run);

          const expectedInputState = mapInputToState(pressedKeys);
          const playerEid = 1 as EntityId;
          const updatedInputState =
            world.components.inputState.get(playerEid);

          expect(updatedInputState).toEqual(expectedInputState);
        }),
      );
    });
  });
});
