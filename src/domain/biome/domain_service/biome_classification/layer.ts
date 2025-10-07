/**
 * Biome Classification Domain Services - Layer Definitions
 */

import { Layer } from 'effect'
import { BiomeMapperServiceLive } from './biome_mapper'
import { ClimateCalculatorServiceLive } from './climate_calculator'
import { EcosystemAnalyzerServiceLive } from './ecosystem_analyzer'

/**
 * バイオーム分類統合レイヤー
 * 気候計算・マッピング・生態系解析を統合
 */
export const BiomeClassificationLayer = Layer.mergeAll(
  ClimateCalculatorServiceLive,
  BiomeMapperServiceLive,
  EcosystemAnalyzerServiceLive
)
