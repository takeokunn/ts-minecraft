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
        world.createEntity(new Position({ x: 1, y: 2, z: 3 })),
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
        world.createEntity(new Position({ x: 1, y: 2, z: 3 })),
      );
      const component = yield* _(world.getComponent(entityId, Velocity));
      expect(Option.isNone(component)).toBe(true);
    }).pipe(Effect.provide(WorldLive), Effect.runPromise));

  it('should query for entities with specific components using querySoA', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World);
      const entity1 = yield* _(
        world.createEntity(
          new Position({ x: 1, y: 2, z: 3 }),
          new Velocity({ dx: 0, dy: 0, dz: 0 }),
        ),
      );
      yield* _(world.createEntity(new Position({ x: 4, y: 5, z: 6 })));

      const results = yield* _(world.querySoA(Position, Velocity));
      expect(results.entities.length).toBe(1);
      expect(results.entities[0]).toBe(entity1);
      expect(results.positions.x[0]).toBe(1);
      expect(results.velocitys.dx[0]).toBe(0);
    }).pipe(Effect.provide(WorldLive), Effect.runPromise));

  it('should get all components for an entity', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World);
      const entityId = yield* _(
        world.createEntity(
          new Position({ x: 1, y: 2, z: 3 }),
          new Velocity({ dx: 10, dy: 20, dz: 30 }),
        ),
      );
      const componentsOpt = yield* _(world.getComponents(entityId));
      expect(Option.isSome(componentsOpt)).toBe(true);
      const components = Option.getOrThrow(componentsOpt);
      expect(components).toHaveLength(2);
      expect(components).toContainEqual(new Position({ x: 1, y: 2, z: 3 }));
      expect(components).toContainEqual(
        new Velocity({ dx: 10, dy: 20, dz: 30 }),
      );
    }).pipe(Effect.provide(WorldLive), Effect.runPromise));

  it('should update a component for an entity', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World);
      const entityId = yield* _(
        world.createEntity(new Position({ x: 1, y: 2, z: 3 })),
      );
      yield* _(
        world.updateComponent(entityId, new Position({ x: 4, y: 5, z: 6 })),
      );
      const component = yield* _(world.getComponent(entityId, Position));

      expect(Option.isSome(component)).toBe(true);
      expect(Option.getOrThrow(component)).toEqual(
        new Position({ x: 4, y: 5, z: 6 }),
      );
    }).pipe(Effect.provide(WorldLive), Effect.runPromise));

  it('should update partial component data for an entity', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World);
      const entityId = yield* _(
        world.createEntity(new Position({ x: 1, y: 2, z: 3 })),
      );
      yield* _(world.updateComponentData(entityId, Position, { y: 99 }));
      const component = yield* _(world.getComponent(entityId, Position));

      expect(Option.isSome(component)).toBe(true);
      expect(Option.getOrThrow(component)).toEqual(
        new Position({ x: 1, y: 99, z: 3 }),
      );
    }).pipe(Effect.provide(WorldLive), Effect.runPromise));

  it('should remove an entity', () =>
    Effect.gen(function* (_) {
      const world = yield* _(World);
      const entityId = yield* _(
        world.createEntity(new Position({ x: 1, y: 2, z: 3 })),
      );
      yield* _(world.removeEntity(entityId));
      const component = yield* _(world.getComponent(entityId, Position));
      const results = yield* _(world.querySoA(Position));

      expect(Option.isNone(component)).toBe(true);
      expect(results.entities.length).toBe(0);
    }).pipe(Effect.provide(WorldLive), Effect.runPromise));
});
