import {
  World,
  ThreeContext,
  BrowserInputState,
  RenderQueue,
  ChunkDataQueue,
  SystemCommand,
} from '@/domain/types';
import {
  cameraControlSystem,
  chunkLoadingSystem,
  collisionSystem,
  inputPollingSystem,
  physicsSystem,
  playerMovementSystem,
  blockInteractionSystem,
  uiSystem,
  updatePhysicsWorldSystem,
  updateTargetSystem,
  worldUpdateSystem,
} from '@/systems';
import { renderScene } from '@/infrastructure/renderer-three/render';
import {
  syncCameraToWorld,
  updateInstancedMeshes,
  updateHighlight,
} from '@/infrastructure/renderer-three/updates';
import { processRenderQueue } from '@/infrastructure/renderer-three/commands';
import { castRay, RaycastResult } from '@/infrastructure/raycast-three';

let animationFrameId: number;

export function tick(
  world: World,
  threeContext: ThreeContext,
  inputState: BrowserInputState,
  renderQueue: RenderQueue,
  chunkDataQueue: ChunkDataQueue,
  handleCommand: (command: SystemCommand) => void,
  dt: number,
  // for testing
  doCastRay: (context: ThreeContext, world: World) => RaycastResult | undefined = castRay,
  doUpdateHighlight: (
    context: ThreeContext,
    world: World,
    raycastResult: RaycastResult | null,
  ) => void = updateHighlight,
): void {
  inputPollingSystem(world, inputState);
  cameraControlSystem(world, inputState);
  playerMovementSystem(world);
  const raycastResult = doCastRay(threeContext, world);
  updateTargetSystem(world, raycastResult);
  doUpdateHighlight(threeContext, world, raycastResult ?? null);
  blockInteractionSystem(world);
  physicsSystem(world, dt);
  updatePhysicsWorldSystem(world);
  collisionSystem(world);
  const commands = chunkLoadingSystem(world);
  for (const command of commands) {
    handleCommand(command);
  }
  worldUpdateSystem(world, chunkDataQueue);
  uiSystem(world);

  updateInstancedMeshes(threeContext, world);
  syncCameraToWorld(threeContext, world);
  processRenderQueue(threeContext, renderQueue);
  renderScene(threeContext);
}

export function startGameLoop(
  world: World,
  threeContext: ThreeContext,
  inputState: BrowserInputState,
  renderQueue: RenderQueue,
  chunkDataQueue: ChunkDataQueue,
  handleCommand: (command: SystemCommand) => void,
): void {
  let lastTime = performance.now();

  function gameLoop() {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    tick(world, threeContext, inputState, renderQueue, chunkDataQueue, handleCommand, dt);
    animationFrameId = requestAnimationFrame(gameLoop);
  }

  gameLoop();
}

export function stopGameLoop(): void {
  cancelAnimationFrame(animationFrameId);
}
