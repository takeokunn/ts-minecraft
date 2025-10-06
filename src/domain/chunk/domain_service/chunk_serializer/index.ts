/**
 * Chunk Serialization Service
 *
 * チャンクデータのシリアライゼーション、デシリアライゼーション、
 * 圧縮、解凍、およびフォーマット変換を提供するドメインサービス
 */

export {
  ChunkSerializationService,
  ChunkSerializationServiceLive,
  SerializationFormat,
  type ChunkSerializationService as ChunkSerializationServiceType,
  type SerializationFormat as SerializationFormatType,
} from './service'
