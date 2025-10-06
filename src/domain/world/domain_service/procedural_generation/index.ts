/**
 * Procedural Generation Domain Services
 *
 * プロシージャル生成の中核となるドメインサービス群
 * DDD原理主義に基づく純粋関数による実装
 */

export * from './layer'
export * from './terrain_generator'

import { TerrainGeneratorService } from './terrain_generator'

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
