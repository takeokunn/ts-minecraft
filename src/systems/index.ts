import { createMainSystem, SystemNode } from "@/runtime/scheduler";
import { blockInteractionSystem } from "./block-interaction";
import { cameraControlSystem } from "./camera-control";
import { chunkLoadingSystem } from "./chunk-loading";
import { collisionSystem } from "./collision";
import { inputPollingSystem } from "./input-polling";
import { physicsSystem } from "./physics";
import { playerMovementSystem } from "./player-movement";
import { updateTargetSystem } from "./update-target-system";
import { uiSystem } from "./ui";
import { updatePhysicsWorldSystem } from "./update-physics-world";
import { worldUpdateSystem } from './world-update';

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
    name: "updatePhysicsWorld",
    system: updatePhysicsWorldSystem,
    after: ["physics"], // Run after positions are updated by physics
    runEvery: 2, // Reduce frequency as it can be expensive
  },
  {
    name: "collision",
    system: collisionSystem,
    after: ["updatePhysicsWorld"], // Run after the spatial grid is populated
  },
  {
    name: "chunkLoading",
    system: chunkLoadingSystem,
    after: ["collision"], // After player has moved
    runEvery: 10, // No need to check every frame
  },
  {
    name: 'worldUpdate',
    system: worldUpdateSystem,
    after: ['chunkLoading'], // Apply generated chunks to the world
  },
  {
    name: "ui",
    system: uiSystem,
    after: ["blockInteraction"], // Reflect inventory changes
  },
];

/**
 * Combines all game systems that run every frame into a single Effect.
 * The execution order is determined by the scheduler based on dependencies.
 */
export const mainSystem = createMainSystem(systems);
