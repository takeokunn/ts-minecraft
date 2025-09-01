import { describe, test, expect, vi } from 'vitest';
import { Effect, Layer, Context, Scope } from 'effect';
import { main } from './main';
import { World } from './runtime/world';
import { ThreeContext } from './infrastructure/renderer-three/context';
import { PointerLockControls } from 'three-stdlib';
import { fc, test as fastCheckTest } from '@fast-check/vitest';

// Mock PointerLockControls for jsdom environment
vi.mock('three/examples/jsm/controls/PointerLockControls', () => ({
  PointerLockControls: vi.fn(() => ({
    domElement: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    lock: vi.fn(),
    unlock: vi.fn(),
  })),
}));

// Test implementation for the World service
const WorldTest = Layer.succeed(
  World,
  World.of({
    createEntity: vi.fn(() => Effect.succeed(undefined)),
    removeEntity: vi.fn(() => Effect.succeed(undefined)),
    getEntity: vi.fn(() => Effect.succeed(undefined)),
    update: vi.fn(() => Effect.succeed(undefined)),
    getEntities: vi.fn(() => Effect.succeed([])),
    getNearbyEntities: vi.fn(() => Effect.succeed([])),
    runQuery: vi.fn(() => []),
    save: vi.fn(() => Effect.succeed('')),
    load: vi.fn(() => Effect.succeed(undefined)),
  }),
);

// Test implementation for the ThreeContext service
const ThreeContextTest = Layer.succeed(
  ThreeContext,
  Context.make(ThreeContext, {
    scene: new (vi.fn())(),
    camera: {
      native: new (vi.fn())(),
      controls: new PointerLockControls(new (vi.fn())(), new (vi.fn())()),
    },
    renderer: {
      domElement: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        style: {},
      },
      render: vi.fn(),
      setSize: vi.fn(),
    },
  } as any),
);

describe('main', () => {
  test('should successfully run the main effect with test layers', async () => {
    const TestLayer = Layer.mergeAll(WorldTest, ThreeContextTest);
    const testProgram = Effect.provide(main, TestLayer);

    // The main effect is scoped and forks a game loop.
    // Running it to completion will also run finalizers,
    // which is what we want to test.
    await expect(Effect.runPromise(testProgram)).resolves.toBeUndefined();
  });

  fastCheckTest.prop([fc.string()])(
    'property-based test example for main',
    async () => {
      // This is a placeholder to show how PBT could be integrated.
      // For a complex effect like `main`, a simple integration check
      // is often more valuable than property-based testing on the whole effect.
      // PBT is better suited for pure functions or smaller, more contained effects.
      const TestLayer = Layer.mergeAll(WorldTest, ThreeContextTest);
      const testProgram = Effect.provide(main, TestLayer);

      await expect(Effect.runPromise(testProgram)).resolves.toBeUndefined();
    },
  );
});