import { Effect, Option } from 'effect';
import { TestClock } from 'effect/Test';
import { describe, it, expect } from 'vitest';
import { Position, Velocity } from '../domain/components';
import { World, WorldLive } from './world';

describe('World', () => {
  it('should create an entity and get its component', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World);
      const entityId = yield* _(
        world.createEntity([new Position({ x: 1, y: 2, z: 3 })]),
      );
      const component = yield* _(world.getComponent(entityId, Position));

      expect(Option.isSome(component)).toBe(true);
      expect(Option.getOrThrow(component)).toEqual(
        new Position({ x: 1, y: 2, z: 3 }),
      );
    }).pipe(Effect.provide(WorldLive), Effect.runPromise));

  it('getComponent should return None for a non-existent component', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World);
      const entityId = yield* _(
        world.createEntity([new Position({ x: 1, y: 2, z: 3 })]),
      );
      const component = yield* _(world.getComponent(entityId, Velocity));
      expect(Option.isNone(component)).toBe(true);
    }).pipe(Effect.provide(WorldLive), Effect.runPromise));

  it('should query for entities with specific components', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World);
      const entity1 = yield* _(
        world.createEntity([
          new Position({ x: 1, y: 2, z: 3 }),
          new Velocity({ dx: 0, dy: 0, dz: 0 }),
        ]),
      );
      yield* _(world.createEntity([new Position({ x: 4, y: 5, z: 6 })]));

      const results = yield* _(world.query(Position, Velocity));
      expect(results.size).toBe(1);
      expect(results.has(entity1)).toBe(true);
      const components = results.get(entity1)!;
      expect(components[0]).toEqual(new Position({ x: 1, y: 2, z: 3 }));
      expect(components[1]).toEqual(new Velocity({ dx: 0, dy: 0, dz: 0 }));
    }).pipe(Effect.provide(WorldLive), Effect.runPromise));

  it('should update a component for an entity', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World);
      const entityId = yield* _(
        world.createEntity([new Position({ x: 1, y: 2, z: 3 })]),
      );
      yield* _(world.updateComponent(entityId, new Position({ x: 4, y: 5, z: 6 })));
      const component = yield* _(world.getComponent(entityId, Position));

      expect(Option.isSome(component)).toBe(true);
      expect(Option.getOrThrow(component)).toEqual(
        new Position({ x: 4, y: 5, z: 6 }),
      );
    }).pipe(Effect.provide(WorldLive), Effect.runPromise));

  it('should remove an entity', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World);
      const entityId = yield* _(
        world.createEntity([new Position({ x: 1, y: 2, z: 3 })]),
      );
      yield* _(world.removeEntity(entityId));
      const component = yield* _(world.getComponent(entityId, Position));
      const results = yield* _(world.query(Position));

      expect(Option.isNone(component)).toBe(true);
      expect(results.size).toBe(0);
    }).pipe(Effect.provide(WorldLive), Effect.runPromise));
});
