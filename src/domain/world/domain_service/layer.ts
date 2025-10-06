import { Layer } from 'effect'
import { BiomeClassificationLayer } from './biome_classification/index'
import { MathematicalOperationsLayer } from './mathematical_operations/index'
import { NoiseGenerationLayer } from './noise_generation/index'
import { ProceduralGenerationLayer } from './procedural_generation/index'
import { WorldValidationLayer } from './world_validation/index'

/**
 * World Domain Service 統合Layer
 *
 * 全てのWorld Domain Serviceを統合した単一のLayerです。
 * 依存関係を適切に解決し、パフォーマンス最適化された
 * 並行処理環境を提供します。
 */
export const WorldDomainServiceLayer = Layer.mergeAll(
  // 基盤サービス（他サービスから依存される）
  MathematicalOperationsLayer,
  NoiseGenerationLayer,

  // 中間サービス（基盤サービスに依存）
  BiomeClassificationLayer,
  WorldValidationLayer,

  // 高レベルサービス（他の全サービスに依存可能）
  ProceduralGenerationLayer
)
