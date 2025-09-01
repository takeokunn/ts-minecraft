
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { fc } from '@fast-check/vitest';
import { PerspectiveCamera, Object3D, WebGLRenderer } from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { match, P } from 'ts-pattern';

import type { ThreeCamera } from '@/domain/types';
import {
  syncCameraToComponent,
  rotateCameraPitch,
  getCameraYaw,
  getCameraPitch,
  moveCameraRight,
  createThreeCamera,
  handleCameraResize,
  rotateCameraYaw,
  lockMouse,
  unlockMouse,
  PLAYER_EYE_HEIGHT,
} from './camera-three';

// Mock PointerLockControls
vi.mock('three/examples/jsm/controls/PointerLockControls.js', () => {
  const PointerLockControlsMock = vi.fn();
  PointerLockControlsMock.prototype.getObject = vi.fn();
  PointerLockControlsMock.prototype.moveRight = vi.fn();
  PointerLockControlsMock.prototype.lock = vi.fn();
  PointerLockControlsMock.prototype.unlock = vi.fn();
  return { PointerLockControls: PointerLockControlsMock };
});

// Helper to create a mocked ThreeCamera instance for tests
const createMockThreeCamera = (): ThreeCamera => {
  const camera = new PerspectiveCamera();
  // PointerLockControls nests the camera within a parent Object3D for yaw control.
  const controlsObject = new Object3D();
  controlsObject.add(camera);

  const controls = new PointerLockControls(camera, document.createElement('canvas'));
  (controls.getObject as Mock).mockReturnValue(controlsObject);

  return { camera, controls };
};

// Arbitraries for Property-Based Testing
const positionArbitrary = fc.record({
  x: fc.float({ noNaN: true }),
  y: fc.float({ noNaN: true }),
  z: fc.float({ noNaN: true }),
});

const cameraStateArbitrary = fc.record({
  pitch: fc.float({ min: -Math.PI / 2, max: Math.PI / 2, noNaN: true }),
  yaw: fc.float({ noNaN: true }),
});

describe('infrastructure/camera-three', () => {
  let mockThreeCamera: ThreeCamera;

  beforeEach(() => {
    mockThreeCamera = createMockThreeCamera();
    vi.clearAllMocks();
  });

  describe('createThreeCamera()', () => {
    it('should correctly initialize a PerspectiveCamera and PointerLockControls', () => {
      const canvas = document.createElement('canvas');
      const { camera, controls } = createThreeCamera(canvas);

      expect(camera).toBeInstanceOf(PerspectiveCamera);
      expect(controls).toBeInstanceOf(PointerLockControls);
      expect(PointerLockControls).toHaveBeenCalledWith(camera, canvas);
    });
  });

  describe('syncCameraToComponent()', () => {
    it('should sync camera position and rotation based on component state', () => {
      fc.assert(
        fc.property(positionArbitrary, cameraStateArbitrary, (pos, state) => {
          // Act
          syncCameraToComponent(mockThreeCamera, pos, state);

          // Assert
          const controlsObject = mockThreeCamera.controls.getObject();
          const expectedY = pos.y + PLAYER_EYE_HEIGHT;

          expect(controlsObject.position.x).toBe(pos.x);
          expect(controlsObject.position.y).toBe(expectedY);
          expect(controlsObject.position.z).toBe(pos.z);
          expect(controlsObject.rotation.y).toBe(state.yaw);
          expect(mockThreeCamera.camera.rotation.x).toBe(state.pitch);
          expect(controlsObject.rotation.order).toBe('YXZ');
        }),
      );
    });
  });

  describe('moveCameraRight()', () => {
    it('should delegate movement to PointerLockControls.moveRight', () => {
      fc.assert(
        fc.property(fc.float({ noNaN: true }), delta => {
          // Act
          moveCameraRight(mockThreeCamera, delta);

          // Assert
          expect(mockThreeCamera.controls.moveRight).toHaveBeenCalledWith(delta);
        }),
      );
    });
  });

  describe('rotateCameraPitch()', () => {
    it('should update camera pitch, clamping it between -PI/2 and PI/2', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -Math.PI, max: Math.PI, noNaN: true }),
          fc.float({ min: -Math.PI, max: Math.PI, noNaN: true }),
          (initialPitch, delta) => {
            // Arrange
            mockThreeCamera.camera.rotation.x = initialPitch;

            // Act
            rotateCameraPitch(mockThreeCamera, delta);
            const newPitch = getCameraPitch(mockThreeCamera);

            // Assert
            const expectedPitch = initialPitch + delta;
            const clampedPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, expectedPitch));

            const resultCategory = match(newPitch)
              .with(P.number.between(-Math.PI / 2, Math.PI / 2), () => 'clamped')
              .otherwise(() => 'not_clamped');

            expect(resultCategory).toBe('clamped');
            expect(newPitch).toBe(clampedPitch);
          },
        ),
      );
    });
  });

  describe('rotateCameraYaw()', () => {
    it('should update camera yaw by the specified delta', () => {
      fc.assert(
        fc.property(
          fc.float({ noNaN: true }),
          fc.float({ noNaN: true }),
          (initialYaw, delta) => {
            // Arrange
            mockThreeCamera.controls.getObject().rotation.y = initialYaw;

            // Act
            rotateCameraYaw(mockThreeCamera, delta);
            const newYaw = getCameraYaw(mockThreeCamera);

            // Assert
            expect(newYaw).toBe(initialYaw + delta);
          },
        ),
      );
    });
  });

  describe('getCameraYaw() and getCameraPitch()', () => {
    it('should return the current yaw and pitch values from the camera state', () => {
      fc.assert(
        fc.property(fc.float({ noNaN: true }), fc.float({ noNaN: true }), (yaw, pitch) => {
          // Arrange
          mockThreeCamera.controls.getObject().rotation.y = yaw;
          mockThreeCamera.camera.rotation.x = pitch;

          // Act & Assert
          expect(getCameraYaw(mockThreeCamera)).toBe(yaw);
          expect(getCameraPitch(mockThreeCamera)).toBe(pitch);
        }),
      );
    });
  });

  describe('handleCameraResize()', () => {
    it('should update camera aspect ratio and renderer size to match window dimensions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 4096 }),
          fc.integer({ min: 1, max: 4096 }),
          (width, height) => {
            // Arrange
            const mockRenderer = {
              setSize: vi.fn(),
            } as unknown as WebGLRenderer;

            global.innerWidth = width;
            global.innerHeight = height;

            mockThreeCamera.camera.aspect = 0; // Reset aspect ratio
            mockThreeCamera.camera.updateProjectionMatrix = vi.fn();

            // Act
            handleCameraResize(mockThreeCamera, mockRenderer);

            // Assert
            expect(mockThreeCamera.camera.aspect).toBe(width / height);
            expect(mockThreeCamera.camera.updateProjectionMatrix).toHaveBeenCalledTimes(1);
            expect(mockRenderer.setSize).toHaveBeenCalledWith(width, height);
          },
        ),
      );
    });
  });

  describe('lockMouse() and unlockMouse()', () => {
    it('should call controls.lock() when lockMouse is called', () => {
      lockMouse(mockThreeCamera);
      expect(mockThreeCamera.controls.lock).toHaveBeenCalledTimes(1);
    });

    it('should call controls.unlock() when unlockMouse is called', () => {
      unlockMouse(mockThreeCamera);
      expect(mockThreeCamera.controls.unlock).toHaveBeenCalledTimes(1);
    });
  });
});
