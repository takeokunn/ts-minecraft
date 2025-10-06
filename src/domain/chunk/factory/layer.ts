/**
 * Chunk Factory Layer
 *
 * Domain Serviceと統合したチャンクファクトリーレイヤー
 */

import { Layer } from 'effect'
import { ChunkDomainServices } from '../domain_service'
import { ChunkFactoryServiceLive } from './chunk_factory'

/**
 * Domain Serviceと統合したファクトリーレイヤー
 * 依存性注入により全てのDomain Serviceを利用可能
 */
export const ChunkFactoryLayer = ChunkFactoryServiceLive.pipe(Layer.provide(ChunkDomainServices))

/**
 * 完全統合チャンクレイヤー
 * Domain Service + Factory Serviceの完全統合
 */
export const ChunkCompleteLayer = Layer.mergeAll(ChunkDomainServices, ChunkFactoryServiceLive)
