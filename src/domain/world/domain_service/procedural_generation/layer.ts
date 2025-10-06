/**
 * Procedural Generation Domain Services - Layer Definitions
 */

import { Layer } from 'effect'
import { TerrainGeneratorServiceLive } from './terrain_generator'

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
