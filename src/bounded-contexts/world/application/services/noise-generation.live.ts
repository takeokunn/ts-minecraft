import { Layer } from 'effect'
import {
  PerlinNoiseService,
  makePerlinNoiseService,
} from '@mc/bc-world/domain/domain_service/noise_generation/perlin-noise-service'
import {
  SimplexNoiseService,
  makeSimplexNoiseService,
} from '@mc/bc-world/domain/domain_service/noise_generation/simplex-noise-service'
import {
  FractalNoiseService,
  makeFractalNoiseService,
} from '@mc/bc-world/domain/domain_service/noise_generation/fractal-noise-service'

/**
 * ノイズ生成サービスの Layer 定義（暫定）
 * TODO: Simplex / Fractal 実装の抽出後に統合予定
 */
export const PerlinNoiseServiceLive = Layer.succeed(
  PerlinNoiseService,
  makePerlinNoiseService(),
)

export const SimplexNoiseServiceLive = Layer.succeed(
  SimplexNoiseService,
  makeSimplexNoiseService(),
)

export const FractalNoiseServiceLive = Layer.succeed(
  FractalNoiseService,
  makeFractalNoiseService(),
)

export const NoiseGenerationLayer = Layer.mergeAll(
  PerlinNoiseServiceLive,
  SimplexNoiseServiceLive,
  FractalNoiseServiceLive,
)

export const NoiseGenerationServices = {
  PerlinNoise: PerlinNoiseService,
  SimplexNoise: SimplexNoiseService,
  FractalNoise: FractalNoiseService,
} as const
