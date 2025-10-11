/**
 * @fileoverview World Application Layer
 * Application層の依存関係を提供し、Domain層に依存
 */

import { WorldDomainLive } from '@/domain/world/layers'
import { Layer } from 'effect'
import { WorldDomainApplicationServiceLayer } from './layer'

/**
 * World Application Layer
 * - Application Service: WorldApplicationServiceLive, WorldGenerationOrchestrator, etc.
 * - 依存: WorldDomainLive (Repository層 + Domain Service層 + Factory層 + Aggregate層)
 */
export const WorldApplicationLive = WorldDomainApplicationServiceLayer.pipe(Layer.provide(WorldDomainLive))
