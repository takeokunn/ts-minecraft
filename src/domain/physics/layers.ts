/**
 * @fileoverview Physics Domain Layer
 * Domain層の依存関係を提供（Domain Service層のみ、Repositoryなし）
 */

import { Layer } from 'effect'
import { CollisionServiceLive, PhysicsSimulationServiceLive, TerrainAdaptationServiceLive } from './domain_service'

/**
 * Physics Domain Layer
 * - Domain Service: CollisionServiceLive, PhysicsSimulationServiceLive, TerrainAdaptationServiceLive
 * - Repository: なし（純粋な計算ロジックのため）
 */
export const PhysicsDomainLive = Layer.mergeAll(
  CollisionServiceLive,
  PhysicsSimulationServiceLive,
  TerrainAdaptationServiceLive
)
