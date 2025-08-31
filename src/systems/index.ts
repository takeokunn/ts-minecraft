import { createMainSystem, SystemNode } from "@/runtime/scheduler";
import { blockInteractionSystem } from "./block-interaction";
import { cameraSystem } from "./camera";
import { cameraControlSystem } from "./camera-control";
import { chunkLoadingSystem } from "./chunk-loading";
import { collisionSystem } from "./collision";
import { inputPollingSystem } from "./input-polling";
import { physicsSystem } from "./physics";
import { playerMovementSystem } from "./player-movement";
import { updateTargetSystem } from "./update-target-system";
import { sceneSystem } from "./scene";
import { uiSystem } from "./ui";

const systems: SystemNode[] = [
  {
    name: "inputPolling",
    system: inputPollingSystem,
  },
  {
    name: "cameraControl",
    system: cameraControlSystem,
    after: ["inputPolling"],
  },
  {
    name: "playerMovement",
    system: playerMovementSystem,
    after: ["inputPolling", "cameraControl"],
  },
  {
    name: "updateTarget",
    system: updateTargetSystem,
    after: ["cameraControl"],
  },
  {
    name: "blockInteraction",
    system: blockInteractionSystem,
    after: ["updateTarget"],
  },
  {
    name: "physics",
    system: physicsSystem,
    after: ["playerMovement"],
  },
  {
    name: "collision",
    system: collisionSystem,
    after: ["physics"],
  },
  {
    name: "chunkLoading",
    system: chunkLoadingSystem,
    after: ["collision"], // After player has moved
  },
  {
    name: "ui",
    system: uiSystem,
    after: ["blockInteraction"], // Reflect inventory changes
  },
  {
    name: "camera",
    system: cameraSystem,
    after: ["collision", "cameraControl"], // Use final player position and rotation
  },
  {
    name: "scene",
    system: sceneSystem,
    after: ["chunkLoading", "collision"], // Render final world state
  },
];

/**
 * Combines all game systems that run every frame into a single Effect.
 * The execution order is determined by the scheduler based on dependencies.
 */
export const mainSystem = createMainSystem(systems);
