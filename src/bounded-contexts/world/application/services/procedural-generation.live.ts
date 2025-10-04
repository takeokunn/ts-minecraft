import { Effect, Layer } from 'effect'
import { TerrainGeneratorService, makeTerrainGeneratorService } from '@mc/bc-world/domain/domain_service/procedural_generation/terrain-generator'

/**
 * プロシージャル生成サービスの標準 Layer 実装。
 * ドメイン層の純粋サービスをアプリケーション層で提供する。
 */
export const TerrainGeneratorServiceLive = Layer.effect(
  TerrainGeneratorService,
  Effect.sync(makeTerrainGeneratorService)
)

export const ProceduralGenerationLayer = Layer.mergeAll(TerrainGeneratorServiceLive)
