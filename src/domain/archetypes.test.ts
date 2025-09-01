import { describe, expect } from 'vitest';
import { test } from '@fast-check/vitest';
import * as fc from 'fast-check';
import { P, match } from 'ts-pattern';

import { getPlayerArchetype, getBlockArchetype } from './archetypes';
import { Position } from './components';
import { blockTypeNames, hotbarSlots, BlockType } from './block';

const positionArb: fc.Arbitrary<Position> = fc.record({
  x: fc.float(),
  y: fc.float(),
  z: fc.float(),
});

const blockTypeArb: fc.Arbitrary<BlockType> = fc.constantFrom(...blockTypeNames);

describe('domain/archetypes', () => {
  describe('getPlayerArchetype', () => {
    test.prop([positionArb])(
      'should create a player archetype with correct initial components and position',
      pos => {
        const archetype = getPlayerArchetype(pos);

        const expectedHotbar = hotbarSlots.reduce(
          (acc, block, i) => {
            acc[`slot${i}`] = block;
            return acc;
          },
          { selectedSlot: 0 } as any,
        );

        const isPlayerArchetype = match(archetype)
          .with(
            {
              player: { isGrounded: false },
              position: pos,
              velocity: { dx: 0, dy: 0, dz: 0 },
              gravity: { value: P.number },
              cameraState: { pitch: 0, yaw: 0 },
              inputState: {
                forward: false,
                backward: false,
                left: false,
                right: false,
                jump: false,
                sprint: false,
                place: false,
                destroy: false,
              },
              collider: {
                width: P.number,
                height: P.number,
                depth: P.number,
              },
              hotbar: expectedHotbar,
              target: {
                entityId: -1,
                faceX: 0,
                faceY: 0,
                faceZ: 0,
              },
            },
            () => true,
          )
          .otherwise(() => false);

        expect(isPlayerArchetype).toBe(true);
        expect(archetype.position).toEqual(pos);
      },
    );
  });

  describe('getBlockArchetype', () => {
    test.prop([positionArb, blockTypeArb])(
      'should create a block archetype with correct components, position, and type',
      (pos, blockType) => {
        const archetype = getBlockArchetype(pos, blockType);

        const isBlockArchetype = match(archetype)
          .with(
            {
              position: pos,
              renderable: {
                geometry: 'box',
                blockType: blockType,
              },
              collider: { width: 1, height: 1, depth: 1 },
            },
            () => true,
          )
          .otherwise(() => false);

        expect(isBlockArchetype).toBe(true);
        expect(archetype.position).toEqual(pos);
        expect(archetype.renderable?.blockType).toBe(blockType);
      },
    );
  });
});