import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  createEntity,
  getEntity,
  WorldLive,
  type World,
} from '../runtime/world';
import { playerControlSystem } from './player';
import { Input } from '../runtime/services';
import { ThreeJsContext } from '../infrastructure/renderer-three';
import type { Input as InputService } from '../runtime/services';

// Mock Input layer for tests
const MockInputLive: Layer.Layer<InputService> = Layer.succeed(
  Input,
  Input.of({
    getMouseState: () =>
      Effect.succeed({ dx: 0, dy: 0, leftClick: false, rightClick: false }),
    poll: () => Effect.void,
  }),
);

// Mock ThreeJsContext for tests
const mockCamera = new THREE.PerspectiveCamera();
const mockControls = {
  moveRight: (_offset: number) => {},
  getObject: () => ({
    children: [mockCamera],
    rotation: { y: 0 },
  }),
};

const MockThreeJsContextLive: Layer.Layer<ThreeJsContext> = Layer.succeed(
  ThreeJsContext,
  ThreeJsContext.of({
    scene: new THREE.Scene(),
    camera: mockCamera,
    renderer: {} as THREE.WebGLRenderer, // Mocked
    controls: mockControls as any,
    highlightMesh: new THREE.Mesh(),
    stats: { begin: () => {}, end: () => {} } as any,
  }),
);

const TestLayer = Layer.mergeAll(
  WorldLive,
  MockInputLive,
  MockThreeJsContextLive,
);

const runTest = <E, A>(
  eff: Effect.Effect<A, E, World | InputService | ThreeJsContext>,
): A => Effect.runSync(eff.pipe(Effect.provide(TestLayer)));

describe('playerControlSystem', () => {
  it("should move forward when 'forward' is true", () => {
    const program = Effect.gen(function* (_) {
      const player = yield* _(
        createEntity(
          { _tag: 'Player', isGrounded: true },
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
            place: false,
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
          { _tag: 'Player', isGrounded: true },
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
            place: false,
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
          { _tag: 'Player', isGrounded: false },
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
            place: false,
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
