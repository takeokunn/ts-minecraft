/**
 * @fileoverview World Application Layer
 * Application層の依存関係を提供し、Domain層に依存
 */

import { BiomeDomainLive } from '@/domain/biome/layers'
import { createWorldDomainLayer } from '@/domain/world/layers'
import { WorldGenerationDomainLive } from '@/domain/world_generation/layers'
import { WorldRepositoryLayer } from '@/infrastructure/world/repository/layers'
import { Layer } from 'effect'
import { WorldDomainApplicationServiceLayer } from './layer'

/**
 * World Application Layer
 * - Application Service: WorldApplicationServiceLive, WorldGenerationOrchestrator, etc.
 * - 依存: World ドメイン Layer (Repository層 + Domain Service層 + Factory層 + Aggregate層)
 */
const worldRepositoryLayer = WorldRepositoryLayer()
const worldGenerationLayer = WorldGenerationDomainLive.pipe(Layer.provide(BiomeDomainLive))

const worldDomainLayer = createWorldDomainLayer({
  repository: worldRepositoryLayer,
  worldGeneration: worldGenerationLayer,
})

export const WorldApplicationLive = WorldDomainApplicationServiceLayer.pipe(Layer.provide(worldDomainLayer))
