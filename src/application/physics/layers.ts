/**
 * @fileoverview Physics Application Layer
 * Application層の依存関係を提供し、Domain層に依存
 */

import { PhysicsDomainLive } from '@/domain/physics/layers'
import { Layer } from 'effect'
import { PerformanceMonitorApplicationServiceLive } from './performance_monitor_service'
import { PhysicsSimulationOrchestratorServiceLive } from './physics_simulation_orchestrator'
import { PlayerPhysicsApplicationServiceLive } from './player_physics_service'
import { WorldCollisionApplicationServiceLive } from './world_collision_service'

/**
 * Physics Application Layer
 * - Application Service: PhysicsSimulationOrchestratorServiceLive, PlayerPhysicsApplicationServiceLive, WorldCollisionApplicationServiceLive
 * - 依存: PhysicsDomainLive (Domain Service層)
 */
export const PhysicsApplicationLive = Layer.mergeAll(
  PerformanceMonitorApplicationServiceLive,
  PhysicsSimulationOrchestratorServiceLive,
  PlayerPhysicsApplicationServiceLive,
  WorldCollisionApplicationServiceLive
).pipe(Layer.provide(PhysicsDomainLive))
