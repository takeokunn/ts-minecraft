import { createArchetype } from '@/domain/archetypes';
import { Hotbar, ChunkGenerationResult, SystemCommand } from '@/domain/types';
import { createInputManager } from '@/infrastructure/input-browser';
import { createMaterialManager } from '@/infrastructure/material-manager';
import {
  createThreeContext,
  processRenderQueue,
  renderScene,
  syncCameraToWorld,
  updateHighlight,
  updateInstancedMeshes,
} from '@/infrastructure/renderer-three';
import { startGameLoop, System } from '@/runtime/loop';
import { createWorld, addArchetype, World } from '@/runtime/world';
import {
  blockInteractionSystem,
  cameraControlSystem,
  chunkLoadingSystem,
  collisionSystem,
  createUISystem,
  inputPollingSystem,
  physicsSystem,
  playerMovementSystem,
  raycastSystem,
  updatePhysicsWorldSystem,
  updateTargetSystem,
  worldUpdateSystem,
} from '@/systems';
import { ComputationTask } from '@/workers/computation.worker';

// Simple worker wrapper
function createComputationWorker() {
  const worker = new Worker(new URL('../workers/computation.worker.ts', import.meta.url), {
    type: 'module',
  });

  const postTask = (task: ComputationTask): Promise<ChunkGenerationResult> => {
    return new Promise((resolve, reject) => {
      const handleMessage = (e: MessageEvent) => {
        resolve(e.data);
        worker.removeEventListener('message', handleMessage);
      };
      const handleError = (e: ErrorEvent) => {
        reject(e);
        worker.removeEventListener('error', handleError);
      };
      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError);
      worker.postMessage(task);
    });
  };

  return {
    postTask,
    close: () => worker.terminate(),
  };
}

async function main() {
  const rootElement = document.getElementById('app');
  if (!rootElement) {
    throw new Error('Root element #app not found');
  }

  // --- Initialization ---
  const inputManager = createInputManager();
  const { context: threeContext, cleanup: cleanupThree } = createThreeContext(rootElement);
  const computationWorker = createComputationWorker();
  const materialManager = createMaterialManager();

  inputManager.registerListeners(threeContext.camera.controls);

  const chunkDataQueue: ChunkGenerationResult[] = [];

  const onCommand = (command: SystemCommand, world: World): World => {
    const taskPayload = {
      ...command,
      seeds: world.globalState.seeds,
      amplitude: world.globalState.amplitude,
              editedBlocks: {
          placed: world.globalState.editedBlocks.placed,
          destroyed: new Set(world.globalState.editedBlocks.destroyed),
        },
    };
    computationWorker
      .postTask({ type: 'generateChunk', payload: taskPayload })
      .then(result => {
        chunkDataQueue.push(result);
      })
      .catch(err => console.error('Failed to process chunk:', err));
    
    // This command handler doesn't modify the world directly, it just kicks off async work.
    // So we can return the world as-is.
    return world;
  };

  const hotbarUpdater = (_hotbar: Hotbar) => {
    // In a real app, this would update a UI component (e.g., React, Solid)
  };

  // --- System Definition ---
  const systems: ReadonlyArray<System> = [
    // Input
    inputPollingSystem,
    cameraControlSystem,
    playerMovementSystem,
    // Physics and Collision
    physicsSystem,
    updatePhysicsWorldSystem, // Rebuilds spatial grid with new positions
    collisionSystem, // Resolves collisions using the new grid
    // Game Logic
    raycastSystem,
    updateTargetSystem,
    blockInteractionSystem,
    chunkLoadingSystem,
    // World Updates from Worker
    worldUpdateSystem,
    // UI
    createUISystem(hotbarUpdater),
  ];

  // --- World Setup ---
  let world = createWorld();
  [world] = addArchetype(world, createArchetype({ type: 'player', pos: { x: 0, y: 20, z: 0 } }));

  const material = await materialManager.get('/assets/atlas.png');

  // --- Start Game Loop ---
  const gameLoop = startGameLoop({
    initialWorld: world,
    systems,
    threeContext,
    inputManager,
    chunkDataQueue,
    renderQueue: [],
    onCommand,
    material,
    renderer: {
      processRenderQueue,
      renderScene,
      syncCameraToWorld,
      updateHighlight,
      updateInstancedMeshes,
    },
  });

  // --- Cleanup ---
  window.addEventListener('beforeunload', () => {
    gameLoop.stop();
    inputManager.cleanup();
    cleanupThree();
    computationWorker.close();
    materialManager.dispose();
  });
}

main().catch(err => {
  console.error('Failed to initialize game:', err);
});