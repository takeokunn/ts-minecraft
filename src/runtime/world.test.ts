import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  type Position,
  PositionSchema,
  type Velocity,
  VelocitySchema,
} from '../domain/components';
import { EntityId } from '../domain/entity';
import {
  createEntity,
  getEntity,
  query,
  updateComponent,
  WorldLive,
} from './world';

describe('World operations', () => {
  it('should create an entity and retrieve its components', () => {
    const position: Position = { _tag: 'Position', x: 1, y: 2, z: 3 };
    const program = Effect.gen(function* (_) {
      const entityId = yield* _(createEntity(position));
      const components = yield* _(getEntity(entityId));
      return { entityId, components };
    });
    const result = Effect.runSync(program.pipe(Effect.provide(WorldLive)));
    expect(result.entityId).toBeDefined();
    expect(result.components).toEqual(new Set([position]));
  });

  it('should return undefined for a non-existent entity', () => {
    const program = getEntity(EntityId('non-existent-id'));
    const result = Effect.runSync(program.pipe(Effect.provide(WorldLive)));
    expect(result).toBeUndefined();
  });

  it('should query for entities with specific components', () => {
    const pos: Position = { _tag: 'Position', x: 1, y: 2, z: 3 };
    const vel: Velocity = { _tag: 'Velocity', dx: 0, dy: 0, dz: 0 };
    const program = Effect.gen(function* (_) {
      const entity1 = yield* _(createEntity(pos, vel));
      yield* _(createEntity(pos)); // Doesn't have velocity
      const results = yield* _(query(PositionSchema, VelocitySchema));
      return { results, entity1 };
    });
    const result = Effect.runSync(program.pipe(Effect.provide(WorldLive)));
    expect(result.results.length).toBe(1);
    const entity = result.results[0]!;
    expect(entity.id).toBe(result.entity1);
    expect(entity.get(PositionSchema)).toEqual(pos);
  });

  it('should update a component for an entity', () => {
    const oldPos: Position = { _tag: 'Position', x: 1, y: 2, z: 3 };
    const newPos: Position = { _tag: 'Position', x: 4, y: 5, z: 6 };
    const program = Effect.gen(function* (_) {
      const entityId = yield* _(createEntity(oldPos));
      yield* _(updateComponent(entityId, newPos));
      const components = yield* _(getEntity(entityId));
      return { components };
    });
    const result = Effect.runSync(program.pipe(Effect.provide(WorldLive)));
    expect(result.components).toEqual(new Set([newPos]));
  });
});
