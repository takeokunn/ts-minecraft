/**
 * Domain Layer - ビジネスロジックとドメインモデル
 *
 * このレイヤーはアプリケーションのコアとなるビジネスロジックを含みます。
 * 技術的な詳細から独立しており、純粋なビジネスルールを表現します。
 * 純粋な関数型プログラミングで実装されます。
 */

// Scene Management Domain
export * from './scene'

// Camera System Domain
export * from './camera'

// Input System Domain
export * from './input'

// Player Management Domain
export * from './player'

// Block System Domain
export * from './block'

// Chunk System Domain - New DDD Structure
export * from './chunk/aggregate'
export * from './chunk/application_service'
export * from './chunk/domain_service'
export * from './chunk/factory'
export * from './chunk/repository'
export * from './chunk/types'
export * from './chunk/value_object'

// 後方互換性のための型エイリアス
export type { ChunkDataAggregate as ChunkData, ChunkId, ChunkPosition } from './chunk'

// Layer統合エクスポート
export { ChunkApplicationServiceLive, ChunkDomainLive, ChunkDomainServiceLive } from './chunk'

// World Generation Domain
export * from './world'

// Combat System Domain
export * from './combat'

// Agriculture System Domain - Temporarily disabled for chunk_loader integration
// export * from './agriculture'

// Chunk Loader Domain - New DDD Structure
export * from './chunk_loader'
