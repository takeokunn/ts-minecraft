/**
 * @fileoverview Biome Domain Layer
 *
 * バイオーム管理の全Domain層サービスを提供
 */

import { Layer } from 'effect'
import { BiomeClassificationServiceLive } from './domain_service/biome_classification'
import { BiomeSystemRepositoryLive } from './repository/biome_system_repository'

/**
 * Biome Domain Layer
 *
 * バイオーム管理コンテキストの全サービス
 */
export const BiomeDomainLive = Layer.mergeAll(BiomeSystemRepositoryLive, BiomeClassificationServiceLive)
