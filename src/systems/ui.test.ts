
import { Effect, Layer } from 'effect';
import { uiSystem } from './ui';
import { World } from '@/runtime/world';
import { EntityId } from '@/domain/entity';
import { fc } from '@fast-check/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeepPartial } from 'vitest';
import { UI } from '@/domain/types';
import { Hotbar } from '@/domain/components';
import { Queries } from '@/domain/queries';
import { blockTypeNames } from '@/domain/block';

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
      hotbar: new Map([
        [
          playerEid,
          {
            selectedSlot: 2,
            slot0: 'dirt',
            slot1: 'stone',
            slot2: 'grass',
          } as Hotbar,
        ],
      ]),
      ...overrides.components,
    },
  };

  return defaultWorld as World;
};

const hotbarArbitrary = fc.record({
  selectedSlot: fc.integer({ min: 0, max: 8 }),
  slots: fc.array(
    fc.option(fc.constantFrom(...blockTypeNames), { nil: undefined }),
    { minLength: 9, maxLength: 9 },
  ),
});

describe('systems/ui', () => {
  const mockUI: UI = {
    updateHotbar: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call UI service with the correct hotbar state', async () => {
    await fc.assert(
      fc.asyncProperty(hotbarArbitrary, async (hotbarData) => {
        vi.clearAllMocks();

        const hotbarComponent: Hotbar = {
          selectedSlot: hotbarData.selectedSlot,
        };
        hotbarData.slots.forEach((item, i) => {
          if (item) {
            (hotbarComponent as any)[`slot${i}`] = item;
          }
        });

        const world = createMockWorld({
          components: {
            hotbar: new Map([[1 as EntityId, hotbarComponent]]),
          },
        });

        const run = Effect.provide(
          uiSystem,
          Layer.mergeAll(
            Layer.succeed(World, world),
            Layer.succeed(UI, mockUI),
          ),
        );

        await Effect.runPromise(run);

        expect(mockUI.updateHotbar).toHaveBeenCalledWith(
          hotbarComponent,
        );
      }),
    );
  });
});
