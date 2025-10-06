/**
 * Noise Generation Domain Services - Layer Definitions
 */

import { Layer } from 'effect'
import { FractalNoiseServiceLive } from './fractal_noise_service'
import { PerlinNoiseServiceLive } from './perlin_noise_service'
import { SimplexNoiseServiceLive } from './simplex_noise_service'

/**
 * ノイズ生成統合レイヤー
 * 全てのノイズ生成サービスを統合
 */
export const NoiseGenerationLayer = Layer.mergeAll(
  PerlinNoiseServiceLive,
  SimplexNoiseServiceLive,
  FractalNoiseServiceLive
)
