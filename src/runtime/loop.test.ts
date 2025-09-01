import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tick, startGameLoop, stopGameLoop } from './loop';
import * as Systems from '@/systems';
import * as RendererUpdates from '@/infrastructure/renderer-three/updates';
import * as RendererCommands from '@/infrastructure/renderer-three/commands';
import * as RendererRender from '@/infrastructure/renderer-three/render';
import {
  World,
  ThreeContext,
  BrowserInputState,
  RenderQueue,
  ChunkDataQueue,
  SystemCommand,
} from '@/domain/types';
import { RaycastResult } from '@/infrastructure/raycast-three';
import * as THREE from 'three';

// Mock all dependencies
vi.mock('@/systems');
vi.mock('@/infrastructure/renderer-three/updates');
vi.mock('@/infrastructure/renderer-three/commands');
vi.mock('@/infrastructure/renderer-three/render');

describe('runtime/loop', () => {
  const mockCastRay = vi.fn();
  const mockUpdateHighlight = vi.fn();
  const mockHandleCommand = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('tick()', () => {
    it('should call all systems and render functions in the correct order', () => {
      const world = {} as World;
      const threeContext = {} as ThreeContext;
      const inputState = {} as BrowserInputState;
      const renderQueue = [] as RenderQueue;
      const chunkDataQueue = [] as ChunkDataQueue;
      const raycastResult = {
        intersection: {} as THREE.Intersection,
      } as RaycastResult;
      const dt = 1 / 60;

      const executionOrder: string[] = [];
      const wrap =
        <T extends (...args: any[]) => any>(name: string, fn: T) =>
        (...args: Parameters<T>): ReturnType<T> => {
          executionOrder.push(name);
          return fn(...args);
        };

      // Setup mocks
      mockCastRay.mockReturnValue(raycastResult);
      vi.mocked(Systems.inputPollingSystem).mockImplementation(wrap('inputPollingSystem', vi.fn()));
      vi.mocked(Systems.cameraControlSystem).mockImplementation(
        wrap('cameraControlSystem', vi.fn()),
      );
      vi.mocked(Systems.playerMovementSystem).mockImplementation(
        wrap('playerMovementSystem', vi.fn()),
      );
      vi.mocked(Systems.updateTargetSystem).mockImplementation(
        wrap('updateTargetSystem', vi.fn()),
      );
      vi.mocked(Systems.blockInteractionSystem).mockImplementation(
        wrap('blockInteractionSystem', vi.fn()),
      );
      vi.mocked(Systems.physicsSystem).mockImplementation(wrap('physicsSystem', vi.fn()));
      vi.mocked(Systems.updatePhysicsWorldSystem).mockImplementation(
        wrap('updatePhysicsWorldSystem', vi.fn()),
      );
      vi.mocked(Systems.collisionSystem).mockImplementation(wrap('collisionSystem', vi.fn()));
      vi.mocked(Systems.chunkLoadingSystem).mockImplementation(
        wrap('chunkLoadingSystem', vi.fn(() => [])),
      );
      vi.mocked(Systems.worldUpdateSystem).mockImplementation(wrap('worldUpdateSystem', vi.fn()));
      vi.mocked(Systems.uiSystem).mockImplementation(wrap('uiSystem', vi.fn()));
      vi.mocked(RendererUpdates.updateInstancedMeshes).mockImplementation(
        wrap('updateInstancedMeshes', vi.fn()),
      );
      vi.mocked(RendererUpdates.syncCameraToWorld).mockImplementation(
        wrap('syncCameraToWorld', vi.fn()),
      );
      vi.mocked(RendererCommands.processRenderQueue).mockImplementation(
        wrap('processRenderQueue', vi.fn()),
      );
      vi.mocked(RendererRender.renderScene).mockImplementation(wrap('renderScene', vi.fn()));

      // Execute tick
      tick(
        world,
        threeContext,
        inputState,
        renderQueue,
        chunkDataQueue,
        mockHandleCommand,
        dt,
        mockCastRay,
        mockUpdateHighlight,
      );

      // Verify order
      const expectedOrder = [
        'inputPollingSystem',
        'cameraControlSystem',
        'playerMovementSystem',
        'updateTargetSystem',
        'blockInteractionSystem',
        'physicsSystem',
        'updatePhysicsWorldSystem',
        'collisionSystem',
        'chunkLoadingSystem',
        'worldUpdateSystem',
        'uiSystem',
        'updateInstancedMeshes',
        'syncCameraToWorld',
        'processRenderQueue',
        'renderScene',
      ];
      // Check call order, ignoring updateHighlight for simplicity for now
      expect(executionOrder).toEqual(expectedOrder);

      // Verify arguments
      expect(Systems.inputPollingSystem).toHaveBeenCalledWith(world, inputState);
      expect(Systems.cameraControlSystem).toHaveBeenCalledWith(world, inputState);
      expect(Systems.playerMovementSystem).toHaveBeenCalledWith(world);
      expect(mockCastRay).toHaveBeenCalledWith(threeContext, world);
      expect(Systems.updateTargetSystem).toHaveBeenCalledWith(world, raycastResult);
      expect(mockUpdateHighlight).toHaveBeenCalledWith(threeContext, raycastResult?.intersection);
      expect(Systems.blockInteractionSystem).toHaveBeenCalledWith(world);
      expect(Systems.physicsSystem).toHaveBeenCalledWith(world, dt);
      expect(Systems.updatePhysicsWorldSystem).toHaveBeenCalledWith(world);
      expect(Systems.collisionSystem).toHaveBeenCalledWith(world);
      expect(Systems.chunkLoadingSystem).toHaveBeenCalledWith(world);
      expect(Systems.worldUpdateSystem).toHaveBeenCalledWith(world, chunkDataQueue);
      expect(Systems.uiSystem).toHaveBeenCalledWith(world);
      expect(RendererUpdates.updateInstancedMeshes).toHaveBeenCalledWith(threeContext, world);
      expect(RendererUpdates.syncCameraToWorld).toHaveBeenCalledWith(threeContext, world);
      expect(RendererCommands.processRenderQueue).toHaveBeenCalledWith(threeContext, renderQueue);
      expect(RendererRender.renderScene).toHaveBeenCalledWith(threeContext);
    });

    it('should handle commands from chunkLoadingSystem', () => {
      const command: SystemCommand = { _tag: 'GenerateChunk', chunkX: 0, chunkZ: 0 };
      vi.mocked(Systems.chunkLoadingSystem).mockReturnValue([command]);

      tick(
        {} as World,
        {} as ThreeContext,
        {} as BrowserInputState,
        [],
        [],
        mockHandleCommand,
        0,
        mockCastRay,
        mockUpdateHighlight,
      );

      expect(mockHandleCommand).toHaveBeenCalledWith(command);
    });
  });

  describe('startGameLoop() and stopGameLoop()', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(global, 'requestAnimationFrame').mockImplementation(
        (cb: FrameRequestCallback) => (cb(0), 1),
      );
      vi.spyOn(global, 'cancelAnimationFrame');
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('should start and stop the game loop', () => {
      startGameLoop(
        {} as World,
        {} as ThreeContext,
        {} as BrowserInputState,
        [],
        [],
        mockHandleCommand,
      );
      expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

      stopGameLoop();
      expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    });
  });
});