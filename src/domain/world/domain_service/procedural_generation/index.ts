/**
 * Procedural Generation Domain Services
 *
 * プロシージャル生成の中核となるドメインサービス群
 * DDD原理主義に基づく純粋関数による実装
 */

// Core Services
export * from './index'
export * from './index'
export * from './index'
export * from './index'

// Unified Procedural Generation Layer
import { Layer } from 'effect'
import { TerrainGeneratorService, TerrainGeneratorServiceLive } from './index'

/**
 * プロシージャル生成統合レイヤー
 * 全てのプロシージャル生成サービスを統合
 */
export const ProceduralGenerationLayer = Layer.mergeAll(
  TerrainGeneratorServiceLive
  // NOTE: 他のサービスのLive実装が完了次第追加
  // StructureSpawnerServiceLive,
  // CaveCarverServiceLive,
  // OrePlacerServiceLive
)

/**
 * プロシージャル生成サービス統合タグ
 */
export const ProceduralGenerationServices = {
  TerrainGenerator: TerrainGeneratorService,
  // NOTE: 他のサービスタグも追加予定
  // StructureSpawner: StructureSpawnerService,
  // CaveCarver: CaveCarverService,
  // OrePlacer: OrePlacerService,
} as const
