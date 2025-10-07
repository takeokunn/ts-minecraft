/**
 * @fileoverview ChunkManager Domain Layer
 * Domain層の依存関係を提供（Domain Service層のみ）
 */

import { ChunkLifecycleProviderLive } from './domain_service'

/**
 * ChunkManager Domain Layer
 * - Domain Service: ChunkLifecycleProviderLive
 * - Repository: なし（他コンテキストのRepositoryに依存）
 */
export const ChunkManagerDomainLive = ChunkLifecycleProviderLive
