import { Effect, Schema } from 'effect';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { hotbarSlots } from './block';
import {
  CameraState,
  Collider,
  Gravity,
  InputState,
  Player,
  Position,
  Renderable,
  TerrainBlock,
  Velocity,
} from './components';

// Helper to create a property-based test for a schema
const testSchema = <T, I>(
  schema: Schema.Schema<T, I>,
  arbitrary: fc.Arbitrary<I>,
): void => {
  it('should encode and decode valid data (PBT)', () => {
    fc.assert(
      fc.property(arbitrary, (data) => {
        const decoded = Schema.decodeSync(schema)(data);
        const encoded = Schema.encodeSync(schema)(decoded);
        // Note: Comparing the encoded result with the original data might not be straightforward
        // if the schema involves transformations. For these components, it should be fine.
        expect(encoded).toEqual(data);
      }),
    );
  });
};

describe('Position component', () => {
  testSchema(
    Position,
    fc.record({
      x: fc.float(),
      y: fc.float(),
      z: fc.float(),
    }),
  );
});

describe('Velocity component', () => {
  testSchema(
    Velocity,
    fc.record({
      dx: fc.float(),
      dy: fc.float(),
      dz: fc.float(),
    }),
  );
});

describe('Renderable component', () => {
  testSchema(
    Renderable,
    fc.record({
      geometry: fc.constant('box'),
      blockType: fc.oneof(...hotbarSlots.map(fc.constant)),
    }),
  );
});

describe('Player component', () => {
  testSchema(Player, fc.record({ isGrounded: fc.boolean() }));
});

describe('InputState component', () => {
  testSchema(
    InputState,
    fc.record({
      forward: fc.boolean(),
      backward: fc.boolean(),
      left: fc.boolean(),
      right: fc.boolean(),
      jump: fc.boolean(),
      sprint: fc.boolean(),
      place: fc.boolean(),
    }),
  );
});

describe('Gravity component', () => {
  testSchema(Gravity, fc.record({ value: fc.float() }));
});

describe('CameraState component', () => {
  testSchema(
    CameraState,
    fc.record({
      pitch: fc.float(),
      yaw: fc.float(),
    }),
  );
});

describe('TerrainBlock component', () => {
  testSchema(TerrainBlock, fc.record({}));
});

describe('Collider component', () => {
  testSchema(
    Collider,
    fc.record({
      width: fc.float({ min: 0 }),
      height: fc.float({ min: 0 }),
      depth: fc.float({ min: 0 }),
    }),
  );
});
