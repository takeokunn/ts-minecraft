
import { Effect, Layer } from 'effect';
import {
  calculateCameraState,
  cameraControlSystem,
} from './camera-control';
import { World } from '@/runtime/world';
import { EntityId } from '@/domain/entity';
import { fc } from '@fast-check/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Camera, Input, DeepPartial } from '@/domain/types';
import { Queries } from '@/domain/queries';

const createMockWorld = (
  initialYaw: number,
  initialPitch: number,
  overrides: DeepPartial<World> = {},
): World => {
  const playerEid = 1 as EntityId;

  const defaultWorld: World = {
    entities: new Set([playerEid]),
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
    },
    ...overrides,
    components: {
      player: new Map([[playerEid, { isGrounded: true }]]),
      cameraState: new Map([
        [playerEid, { yaw: initialYaw, pitch: initialPitch }],
      ]),
      ...overrides.components,
    },
  };

  return defaultWorld as any;
};

const mouseDeltaArbitrary = fc.record({
  dx: fc.float({ min: -500, max: 500, noNaN: true }),
  dy: fc.float({ min: -500, max: 500, noNaN: true }),
});

const cameraStateArbitrary = fc.record({
  yaw: fc.float({ min: -Math.PI, max: Math.PI, noNaN: true }),
  pitch: fc.float({
    min: -Math.PI / 2,
    max: Math.PI / 2,
    noNaN: true,
  }),
});

describe('systems/camera-control', () => {
  const SENSITIVITY = 0.002;

  describe('calculateCameraState', () => {
    it('should update yaw and pitch based on mouse delta', () => {
      fc.assert(
        fc.property(
          mouseDeltaArbitrary,
          cameraStateArbitrary,
          (mouseDelta, initialState) => {
            const { yaw, pitch } = calculateCameraState(
              initialState,
              mouseDelta,
              SENSITIVITY,
            );

            const expectedYaw =
              initialState.yaw - mouseDelta.dx * SENSITIVITY;
            const expectedPitch =
              initialState.pitch - mouseDelta.dy * SENSITIVITY;
            const clampedPitch = Math.max(
              -Math.PI / 2,
              Math.min(Math.PI / 2, expectedPitch),
            );

            expect(yaw).toBeCloseTo(expectedYaw);
            expect(pitch).toBeCloseTo(clampedPitch);
          },
        ),
      );
    });

    it('should clamp pitch between -PI/2 and PI/2', () => {
      fc.assert(
        fc.property(
          mouseDeltaArbitrary,
          cameraStateArbitrary,
          (mouseDelta, initialState) => {
            const { pitch } = calculateCameraState(
              initialState,
              mouseDelta,
              SENSITIVITY,
            );
            expect(pitch).toBeGreaterThanOrEqual(-Math.PI / 2);
            expect(pitch).toBeLessThanOrEqual(Math.PI / 2);
          },
        ),
      );
    });
  });

  describe('cameraControlSystem', () => {
    const mockCamera: Camera = {
      rotatePitch: vi.fn(),
      setYaw: vi.fn(),
    };

    const mockInput: Input = {
      getMouseDelta: vi.fn(),
      getKeyboardState: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should update camera component and camera infrastructure based on mouse delta (PBT)', async () => {
      await fc.assert(
        fc.asyncProperty(
          mouseDeltaArbitrary,
          cameraStateArbitrary,
          async (mouseDelta, initialState) => {
            vi.clearAllMocks();

            const world = createMockWorld(
              initialState.yaw,
              initialState.pitch,
            );
            (mockInput.getMouseDelta as vi.Mock).mockReturnValue(
              mouseDelta,
            );

            const run = Effect.provide(
              cameraControlSystem,
              Layer.mergeAll(
                Layer.succeed(World as any, world as any),
                Layer.succeed(Input as any, mockInput as any),
                Layer.succeed(Camera as any, mockCamera as any),
              ),
            );

            await Effect.runPromise(run);

            const { yaw, pitch } = calculateCameraState(
              initialState,
              mouseDelta,
              SENSITIVITY,
            );

            const playerEid = 1 as EntityId;
            const updatedCameraState =
              (world as any).components.cameraState.get(playerEid);

            expect(updatedCameraState).toEqual({
              yaw,
              pitch,
            });
            expect(mockCamera.setYaw).toHaveBeenCalledWith(yaw);
            expect(mockCamera.rotatePitch).toHaveBeenCalledWith(
              pitch - initialState.pitch,
            );
          },
        ),
      );
    });
  });
});
