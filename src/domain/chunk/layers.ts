import { Layer } from 'effect'
import { ChunkDomainServices } from './domain_service'

export interface ChunkDomainLayerOptions {
  readonly repository: Layer.Layer<any>
}

/**
 * Chunk Domain Layer
 *
 * ドメインサービスとリポジトリをまとめるためのヘルパー。
 * CQRS やアプリケーションユースケースはアプリ側で組み立てる。
 */
export const createChunkDomainLayer = (options: ChunkDomainLayerOptions) =>
  Layer.mergeAll(ChunkDomainServices, options.repository)
