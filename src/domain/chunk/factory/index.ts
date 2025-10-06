/**
 * Chunk Factory Layer
 *
 * Domain Serviceと統合したチャンクファクトリーを提供
 * 全てのファクトリーサービスの統合レイヤー
 */

// 個別ファクトリーの再エクスポート
export {
  ChunkFactoryService,
  ChunkFactoryServiceLive,
  type ChunkFactoryService as ChunkFactoryServiceType,
} from './chunk_factory'

// Layer implementations
export * from './layer'
