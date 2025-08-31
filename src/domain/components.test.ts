import { Effect, Schema } from 'effect';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { hotbarSlots } from '../runtime/game-state';
import {
  CameraStateSchema,
  ColliderSchema,
  GravitySchema,
  InputStateSchema,
  PlayerSchema,
  PositionSchema,
  RenderableSchema,
  TerrainBlockSchema,
  VelocitySchema,
} from './components';

// Helper to create a property-based test for a schema
const testSchema = <T, I = T>(
  schema: Schema.Schema<T, I>,
  arbitrary: fc.Arbitrary<I>,
): void => {
  it('should encode and decode valid data (PBT)', () => {
    fc.assert(
      fc.property(arbitrary, (data) => {
        const decoded = Schema.decodeSync(schema)(data);
        const encoded = Schema.encodeSync(schema)(decoded);
        expect(encoded).toEqual(data);
      }),
    );
  });

  it('should fail to decode invalid data (PBT)', () => {
    fc.assert(
      fc.property(fc.anything(), (data) => {
        // Filter out valid data from the 'anything' arbitrary
        if (Schema.is(schema)(data)) {
          fc.pre(false);
        }
        const program = Schema.decodeUnknown(schema)(data);
        const result = Effect.runSyncExit(program);
        expect(result._tag).toBe('Failure');
      }),
    );
  });
};

describe('Position component', () => {
  testSchema(
    PositionSchema,
    fc.record({
      _tag: fc.constant('Position'),
      x: fc.float(),
      y: fc.float(),
      z: fc.float(),
    }),
  );
});

describe('Velocity component', () => {
  testSchema(
    VelocitySchema,
    fc.record({
      _tag: fc.constant('Velocity'),
      dx: fc.float(),
      dy: fc.float(),
      dz: fc.float(),
    }),
  );
});

describe('Renderable component', () => {
  testSchema(
    RenderableSchema,
    fc.record({
      _tag: fc.constant('Renderable'),
      geometry: fc.constant('box'),
      blockType: fc.oneof(...hotbarSlots.map(fc.constant)),
    }),
  );
});

describe('Player component', () => {
  testSchema(
    PlayerSchema,
    fc.record({ _tag: fc.constant('Player'), isGrounded: fc.boolean() }),
  );
});

describe('InputState component', () => {
  testSchema(
    InputStateSchema,
    fc.record({
      _tag: fc.constant('InputState'),
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
  testSchema(
    GravitySchema,
    fc.record({
      _tag: fc.constant('Gravity'),
      value: fc.float(),
    }),
  );
});

describe('CameraState component', () => {
  testSchema(
    CameraStateSchema,
    fc.record({
      _tag: fc.constant('CameraState'),
      pitch: fc.float(),
      yaw: fc.float(),
    }),
  );
});

describe('TerrainBlock component', () => {
  testSchema(
    TerrainBlockSchema,
    fc.record({ _tag: fc.constant('TerrainBlock') }),
  );
});

describe('Collider component', () => {
  testSchema(
    ColliderSchema,
    fc.record({
      _tag: fc.constant('Collider'),
      width: fc.float({ min: 0 }),
      height: fc.float({ min: 0 }),
      depth: fc.float({ min: 0 }),
    }),
  );
});
