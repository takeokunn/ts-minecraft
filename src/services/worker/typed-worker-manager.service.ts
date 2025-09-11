import { Context, Effect, Duration } from 'effect'

import {
  createTypedWorkerClient,
  createWorkerFactory,
  createWorkerPool,
  WorkerClientConfig,
} from '@/workers/base/typed-worker'
import {
  WorkerRequestPayload,
  WorkerResponsePayload,
  TerrainGenerationRequest,
  TerrainGenerationResponse,
  PhysicsSimulationRequest,
  PhysicsSimulationResponse,
  MeshGenerationRequest,
  MeshGenerationResponse,
  LightingCalculationRequest,
  LightingCalculationResponse,
} from '@/workers/shared/protocol'

/**
 * Advanced typed worker manager service
 * Manages multiple worker types with type safety and performance optimization
 */

// ============================================
// Worker Types Configuration
// ============================================

export type WorkerType = 'terrain' | 'physics' | 'mesh' | 'lighting'

export interface WorkerPoolConfig {
  poolSize: number
  timeout: Duration.Duration
  maxConcurrentRequests: number
}

export interface WorkerManagerConfig {
  terrain: WorkerPoolConfig
  physics: WorkerPoolConfig
  mesh: WorkerPoolConfig
  lighting: WorkerPoolConfig
}

// ============================================
// Service Definition
// ============================================

export class TypedWorkerManager extends Context.Tag('TypedWorkerManager')<
  TypedWorkerManager,
  {
    readonly initialize: (config: WorkerManagerConfig) => Effect.Effect<void, never, never>
    readonly sendTerrainRequest: (request: TerrainGenerationRequest) => Effect.Effect<TerrainGenerationResponse, never, never>
    readonly sendPhysicsRequest: (request: PhysicsSimulationRequest) => Effect.Effect<PhysicsSimulationResponse, never, never>
    readonly sendMeshRequest: (request: MeshGenerationRequest) => Effect.Effect<MeshGenerationResponse, never, never>
    readonly sendLightingRequest: (request: LightingCalculationRequest) => Effect.Effect<LightingCalculationResponse, never, never>
    readonly getWorkerStats: () => Effect.Effect<{
      terrain: { active: number; queued: number }
      physics: { active: number; queued: number }
      mesh: { active: number; queued: number }
      lighting: { active: number; queued: number }
    }, never, never>
    readonly terminateAll: () => Effect.Effect<void, never, never>
  }
>() {}