import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import { createEntity, getEntity, WorldLive, type World } from '../runtime/world';
import { playerControlSystem } from './player';

const runTest = <E, A>(eff: Effect.Effect<A, E, World>): A =>
  Effect.runSync(eff.pipe(Effect.provide(WorldLive)));

describe('playerControlSystem', () => {
  it("should move forward when 'forward' is true", () => {
    const program = Effect.gen(function* (_) {
      const player = yield* _(
        createEntity(
          { _tag: 'Player' },
          { _tag: 'Velocity', dx: 0, dy: 0, dz: 0 },
          { _tag: 'CameraState', pitch: 0, yaw: 0 },
          {
            _tag: 'InputState',
            forward: true,
            backward: false,
            left: false,
            right: false,
            jump: false,
            sprint: false,
          },
        ),
      );

      yield* _(playerControlSystem);

      const components = yield* _(getEntity(player));
      return [...(components ?? [])].find((c) => c._tag === 'Velocity');
    });

    const finalVelocity = runTest(program);
    expect(finalVelocity?.dz).toBeLessThan(0);
    expect(finalVelocity?.dx).toBe(0);
  });

  it("should jump when 'jump' is true and player is on ground", () => {
    const program = Effect.gen(function* (_) {
      const player = yield* _(
        createEntity(
          { _tag: 'Player' },
          { _tag: 'Velocity', dx: 0, dy: 0, dz: 0 }, // on ground
          { _tag: 'CameraState', pitch: 0, yaw: 0 },
          {
            _tag: 'InputState',
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: true,
            sprint: false,
          },
        ),
      );

      yield* _(playerControlSystem);

      const components = yield* _(getEntity(player));
      return [...(components ?? [])].find((c) => c._tag === 'Velocity');
    });

    const finalVelocity = runTest(program);
    expect(finalVelocity?.dy).toBeGreaterThan(0);
  });

  it('should not jump when player is in the air', () => {
    const program = Effect.gen(function* (_) {
      const player = yield* _(
        createEntity(
          { _tag: 'Player' },
          { _tag: 'Velocity', dx: 0, dy: -0.5, dz: 0 }, // in the air
          { _tag: 'CameraState', pitch: 0, yaw: 0 },
          {
            _tag: 'InputState',
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: true,
            sprint: false,
          },
        ),
      );

      yield* _(playerControlSystem);

      const components = yield* _(getEntity(player));
      return [...(components ?? [])].find((c) => c._tag === 'Velocity');
    });

    const finalVelocity = runTest(program);
    // dy should be unaffected by jump input
    expect(finalVelocity?.dy).toBe(-0.5);
  });
});
