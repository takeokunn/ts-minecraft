import type { ThreeContext } from '@/infrastructure/renderer-three';
import type { BrowserInputState, InputManager } from '@/infrastructure/input-browser';
import type { World } from './world';
import type { Material } from 'three';
import type { ChunkDataQueue, RenderQueue, SystemCommand } from '@/domain/types';

// --- System Types ---

/**
 * A System is a function that takes the current World and dependencies,
 * and returns a tuple containing the new World state and an array of commands to be executed.
 */
export type System = (
  world: World,
  deps: SystemDependencies,
) => readonly [World, readonly SystemCommand[]];

export type SystemDependencies = {
  readonly deltaTime: number;
  readonly inputState: BrowserInputState;
  readonly mouseDelta: { readonly dx: number; readonly dy: number };
  readonly threeContext: ThreeContext;
  readonly chunkDataQueue: ChunkDataQueue;
  readonly renderQueue: RenderQueue;
};

// --- Renderer Types ---
export type Renderer = {
  readonly processRenderQueue: (
    threeContext: ThreeContext,
    renderQueue: RenderQueue,
    material: Material,
  ) => void;
  readonly syncCameraToWorld: (threeContext: ThreeContext, world: World) => void;
  readonly updateHighlight: (threeContext: ThreeContext, world: World) => void;
  readonly updateInstancedMeshes: (threeContext: ThreeContext, world: World) => void;
  readonly renderScene: (threeContext: ThreeContext) => void;
};

// --- Game Loop Types ---
export type GameLoopDependencies = {
  readonly initialWorld: World;
  readonly threeContext: ThreeContext;
  readonly inputManager: InputManager;
  readonly renderQueue: RenderQueue;
  readonly chunkDataQueue: ChunkDataQueue;
  readonly systems: readonly System[];
  readonly onCommand: (command: SystemCommand, world: World) => World;
  readonly material: Material;
  readonly renderer: Renderer;
};

export type GameLoop = {
  readonly stop: () => void;
};

export function startGameLoop(deps: GameLoopDependencies): GameLoop {
  const {
    initialWorld,
    threeContext,
    inputManager,
    renderQueue,
    chunkDataQueue,
    systems,
    onCommand,
    material,
    renderer,
  } = deps;

  let animationFrameId: number;
  let lastTime = performance.now();
  let world = initialWorld;

  function gameLoop(currentTime: number) {
    animationFrameId = requestAnimationFrame(gameLoop);

    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    const systemDeps: SystemDependencies = {
      deltaTime,
      inputState: inputManager.getState(),
      mouseDelta: inputManager.getMouseDelta(),
      threeContext,
      chunkDataQueue,
      renderQueue,
    };

    // Process systems and commands
    const newWorld = systems.reduce((currentWorld, system) => {
      const [worldAfterSystem, commands] = system(currentWorld, systemDeps);

      // Execute commands immediately, allowing the world to be updated before the next system runs.
      const worldAfterCommands = commands.reduce(
        (w, command) => onCommand(command, w),
        worldAfterSystem,
      );

      return worldAfterCommands;
    }, world);

    world = newWorld;

    // Render
    renderer.processRenderQueue(threeContext, renderQueue, material);
    renderer.syncCameraToWorld(threeContext, world);
    renderer.updateHighlight(threeContext, world);
    renderer.updateInstancedMeshes(threeContext, world);
    renderer.renderScene(threeContext);
  }

  animationFrameId = requestAnimationFrame(gameLoop);

  return {
    stop: () => {
      cancelAnimationFrame(animationFrameId);
    },
  };
}