import { Effect, Layer } from 'effect';
import { World } from '@/runtime/world';
import {
  checkPlayerCollision,
  blockInteractionSystem,
} from './block-interaction';
import { EntityId } from '@/domain/entity';
import { hotbarSlots } from '@/domain/block';
import { Archetypes } from '@/domain/archetypes';
import { Queries } from '@/domain/queries';
import { fc } from '@fast-check/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Components, Position, Collider } from '@/domain/components';
import { DeepPartial } from '@/domain/types';

vi.mock('@/domain/archetypes', () => ({
  Archetypes: {
    createBlock: vi.fn((pos: any, type: any) =>
      Effect.succeed({
        id: 3 as EntityId,
        position: pos,
        block: { type },
      }),
    ),
  },
}));

const createBlockSpy = vi.spyOn(Archetypes, 'createBlock');

const createMockWorld = (
  overrides: DeepPartial<World> = {},
): World => {
  const playerEid = 1 as EntityId;
  const targetEid = 2 as EntityId;

  const defaultWorld: World = {
    entities: new Set([playerEid, targetEid]),
    archetypes: Archetypes,
    queries: Queries,
    globalState: {
      isPaused: false,
      physics: {
        gravity: 20,
        simulationRate: 60,
      },
      player: {
        id: playerEid,
      },
      chunk: {
        renderDistance: 2,
        unloadDistance: 3,
        size: 16,
      },
      ...overrides.globalState,
      editedBlocks: {
        placed: new Map(),
        destroyed: new Set(),
        ...overrides.globalState?.editedBlocks,
      },
    },
    removeEntity: vi.fn(() => Effect.succeed(true)),
    createEntity: vi.fn(() => 4 as EntityId),
    ...overrides,
    components: {
      player: new Map([[playerEid, { isGrounded: true }]]),
      inputState: new Map([
        [
          playerEid,
          {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            place: false,
            destroy: false,
          },
        ],
      ]),
      position: new Map([
        [playerEid, { x: 0, y: 0, z: 0 }],
        [targetEid, { x: 5, y: 0, z: 0 }],
      ]),
      velocity: new Map([[playerEid, { x: 0, y: 0, z: 0 }]]),
      collider: new Map([
        [playerEid, { width: 0.6, height: 1.8, depth: 0.6 }],
      ]),
      target: new Map([
        [
          playerEid,
          { entityId: targetEid, faceX: -1, faceY: 0, faceZ: 0 },
        ],
      ]),
      hotbar: new Map([
        [
          playerEid,
          {
            selectedSlot: 0,
            slot0: 'dirt',
            slot1: 'stone',
            slot2: 'grass',
            slot3: 'glass',
            slot4: 'oakLog',
            slot5: 'oakLeaves',
            slot6: 'sand',
            slot7: 'cobblestone',
          },
        ],
      ]),
      ...overrides.components,
    },
  };

  return defaultWorld as any;
};

const positionArbitrary = fc.record({
  x: fc.float({ min: -100, max: 100 }),
  y: fc.float({ min: -100, max: 100 }),
  z: fc.float({ min: -100, max: 100 }),
});

const playerSizeArbitrary = fc.record({
  width: fc.float({ min: 0.1, max: 2 }),
  height: fc.float({ min: 0.1, max: 4 }),
  depth: fc.float({ min: 0.1, max: 2 }),
});

describe('systems/block-interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkPlayerCollision() with PBT', () => {
    it('should return true when player is inside the block', () => {
      fc.assert(
        fc.property(
          positionArbitrary as fc.Arbitrary<Position>,
          playerSizeArbitrary as fc.Arbitrary<Collider>,
          (pos, size) => {
            const result = checkPlayerCollision(pos, pos, size);
            expect(result).toBe(true);
          },
        ),
      );
    });

    it('should return false when player is far from the block', () => {
      fc.assert(
        fc.property(
          positionArbitrary as fc.Arbitrary<Position>,
          playerSizeArbitrary as fc.Arbitrary<Collider>,
          (pos, size) => {
            const playerPos = {
              x: pos.x + 10,
              y: pos.y + 10,
              z: pos.z + 10,
            };
            const result = checkPlayerCollision(pos, playerPos, size);
            expect(result).toBe(false);
          },
        ),
      );
    });

    it('should return false when AABBs are just touching at the boundary', () => {
      fc.assert(
        fc.property(
          positionArbitrary as fc.Arbitrary<Position>,
          playerSizeArbitrary as fc.Arbitrary<Collider>,
          (pos, size) => {
            const playerPos = {
              x: pos.x + 0.5 + size.width / 2,
              y: pos.y,
              z: pos.z,
            };
            const result = checkPlayerCollision(pos, playerPos, size);
            expect(result).toBe(false);
          },
        ),
      );
    });
  });

  describe('blockInteractionSystem() with PBT', () => {
    const runSystem = (world: World) => {
      const testEffect = Effect.provide(
        blockInteractionSystem,
        Layer.succeed(World as any, world as any),
      );
      return Effect.runPromise(testEffect);
    };

    it('should do nothing if no input is pressed', async () => {
      const world = createMockWorld();
      await runSystem(world);
      expect(world.removeEntity).not.toHaveBeenCalled();
      expect(createBlockSpy).not.toHaveBeenCalled();
    });

    it('should destroy a block when destroy input is pressed', async () => {
      await fc.assert(
        fc.asyncProperty(positionArbitrary as fc.Arbitrary<Position>, async (targetPos) => {
          const playerEid = 1 as EntityId;
          const targetEid = 2 as EntityId;
          const world = createMockWorld({
            components: {
              inputState: new Map([
                [
                  playerEid,
                  {
                    ...Components.inputState(),
                    destroy: true,
                  },
                ],
              ]),
              position: new Map([
                [playerEid, { x: 0, y: 0, z: 0 }],
                [targetEid, targetPos],
              ]),
            },
          });

          await runSystem(world);

          expect(world.removeEntity).toHaveBeenCalledWith(targetEid);
          const key = `${targetPos.x},${targetPos.y},${targetPos.z}`;
          expect(
            (world as any).globalState.editedBlocks.destroyed.has(key),
          ).toBe(true);
        }),
      );
    });

    it('should place a block when place input is pressed', async () => {
      const faceArbitrary = fc.constantFrom(
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 },
      );
      const hotbarArbitrary = fc.record({
        slot: fc.integer({
          min: 0,
          max: hotbarSlots.length - 1,
        }),
        type: fc.constantFrom(...(hotbarSlots as any)),
      });

      await fc.assert(
        fc.asyncProperty(
          positionArbitrary as fc.Arbitrary<Position>,
          faceArbitrary,
          hotbarArbitrary,
          async (targetPos, face, hotbar) => {
            const playerEid = 1 as EntityId;
            const targetEid = 2 as EntityId;
            const newBlockPos = {
              x: targetPos.x + face.x,
              y: targetPos.y + face.y,
              z: targetPos.z + face.z,
            };
            const hotbarComponent = {
              ...Components.hotbar(),
              selectedSlot: hotbar.slot,
              [`slot${hotbar.slot}`]: hotbar.type,
            };

            const world = createMockWorld({
              components: {
                inputState: new Map([
                  [
                    playerEid,
                    {
                      ...Components.inputState(),
                      place: true,
                    },
                  ],
                ]),
                position: new Map([
                  [playerEid, { x: 999, y: 999, z: 999 }],
                  [targetEid, targetPos],
                ]),
                target: new Map([
                  [
                    playerEid,
                    {
                      entityId: targetEid,
                      faceX: face.x,
                      faceY: face.y,
                      faceZ: face.z,
                    },
                  ],
                ]),
                hotbar: new Map([[playerEid, hotbarComponent as any]]),
              },
            });

            await runSystem(world);

            expect(createBlockSpy).toHaveBeenCalledWith(
              newBlockPos,
              hotbar.type,
            );
            const key = `${newBlockPos.x},${newBlockPos.y},${newBlockPos.z}`;
            expect(
              (world as any).globalState.editedBlocks.placed.get(key)
                ?.blockType,
            ).toBe(hotbar.type);
          },
        ),
      );
    });

    it('should not place a block if it collides with the player', async () => {
      const playerEid = 1 as EntityId;
      const targetEid = 2 as EntityId;
      const world = createMockWorld({
        components: {
          inputState: new Map([
            [
              playerEid,
              {
                ...Components.inputState(),
                place: true,
              },
            ],
          ]),
          position: new Map([
            [playerEid, { x: 4, y: 0, z: 0 }],
            [targetEid, { x: 5, y: 0, z: 0 }],
          ]),
          target: new Map([
            [
              playerEid,
              {
                entityId: targetEid,
                faceX: -1,
                faceY: 0,
                faceZ: 0,
              },
            ],
          ]),
        },
      });

      await runSystem(world);

      expect(createBlockSpy).not.toHaveBeenCalled();
    });
  });
});