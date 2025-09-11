import { Context, Effect, Ref, Duration } from 'effect'
import * as S from "/schema/Schema"
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
    readonly initialize: (config: WorkerManagerConfig) => Effect.Effect<void>
    readonly sendTerrainRequest: (request: TerrainGenerationRequest) => Effect.Effect<TerrainGenerationResponse>
    readonly sendPhysicsRequest: (request: PhysicsSimulationRequest) => Effect.Effect<PhysicsSimulationResponse>
    readonly sendMeshRequest: (request: MeshGenerationRequest) => Effect.Effect<MeshGenerationResponse>
    readonly sendLightingRequest: (request: LightingCalculationRequest) => Effect.Effect<LightingCalculationResponse>
    readonly getWorkerStats: () => Effect.Effect<{
      terrain: { active: number; queued: number }
      physics: { active: number; queued: number }
      mesh: { active: number; queued: number }
      lighting: { active: number; queued: number }
    }>
    readonly terminateAll: () => Effect.Effect<void>
  }
>() {}