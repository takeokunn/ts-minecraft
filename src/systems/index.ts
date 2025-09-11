/**
 * Modern Systems Registry with Scheduler Integration
 * Exports refactored systems and centralized system management
 */

// Core system infrastructure
export { SystemScheduler, createSystemScheduler, defaultSchedulerConfig } from './core/scheduler'
export { SystemCommunicationHub, globalCommunicationHub, SystemCommunicationUtils } from './core/system-communication'
export * from './core/performance-monitor'

// Individual system exports
export { blockInteractionSystem } from './block-interaction'
export { cameraControlSystem } from './camera-control'
export { chunkLoadingSystem } from './chunk-loading'
export { collisionSystem } from './collision'
export { inputPollingSystem } from './input-polling'
export { physicsSystem } from './physics'
export { playerMovementSystem } from './player-movement'
export { updateTargetSystem } from './update-target-system'
export { createUISystem } from './ui'
export { updatePhysicsWorldSystem } from './update-physics-world'
export { worldUpdateSystem } from './world-update'

// System registry for scheduler integration
export { createSystemRegistry, defaultSystemRegistry } from './registry'
