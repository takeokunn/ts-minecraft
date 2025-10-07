/**
 * Noise Generation Domain Services
 *
 * 数学的ノイズ生成の中核となるドメインサービス群
 * 高性能かつ高品質なノイズアルゴリズム実装
 */

export * from './fractal_noise_service'
export * from './layer'
export * from './perlin_noise_service'
export * from './simplex_noise_service'

import { FractalNoiseService } from './fractal_noise_service'
import { PerlinNoiseService } from './perlin_noise_service'
import { SimplexNoiseService } from './simplex_noise_service'

/**
 * ノイズ生成サービス統合タグ
 */
export const NoiseGenerationServices = {
  PerlinNoise: PerlinNoiseService,
  SimplexNoise: SimplexNoiseService,
  FractalNoise: FractalNoiseService,
} as const

/**
 * 高レベルノイズ生成ファクトリ
 */
export const NoiseFactory = {
  /**
   * 地形生成用ノイズ設定
   */
  createTerrainNoise: () => ({
    type: 'brownian_motion' as const,
    baseFrequency: 0.005,
    baseAmplitude: 100.0,
    octaves: 6,
    lacunarity: 2.0,
    persistence: 0.5,
    gain: 1.0,
    seed: 12345n,
    baseNoiseType: 'perlin' as const,
    enableDomainWarping: false,
    enableAntiAliasing: true,
    enableOctaveWeighting: true,
    enableSpectralControl: false,
    enableClamping: true,
  }),

  /**
   * 洞窟生成用ノイズ設定
   */
  createCaveNoise: () => ({
    type: 'ridged_multifractal' as const,
    baseFrequency: 0.02,
    baseAmplitude: 1.0,
    octaves: 4,
    lacunarity: 2.5,
    persistence: 0.3,
    gain: 2.0,
    seed: 54321n,
    baseNoiseType: 'simplex' as const,
    enableDomainWarping: true,
    warpStrength: 0.15,
    ridgeOffset: 1.0,
    enableAntiAliasing: true,
    enableClamping: true,
  }),

  /**
   * 鉱石分布用ノイズ設定
   */
  createOreNoise: () => ({
    type: 'turbulence' as const,
    baseFrequency: 0.01,
    baseAmplitude: 1.0,
    octaves: 3,
    lacunarity: 2.2,
    persistence: 0.4,
    gain: 1.5,
    seed: 98765n,
    baseNoiseType: 'simplex' as const,
    enableDomainWarping: false,
    enableAntiAliasing: true,
    enableClamping: true,
  }),

  /**
   * バイオーム分布用ノイズ設定
   */
  createBiomeNoise: () => ({
    type: 'brownian_motion' as const,
    baseFrequency: 0.001,
    baseAmplitude: 1.0,
    octaves: 4,
    lacunarity: 2.0,
    persistence: 0.6,
    gain: 1.0,
    seed: 13579n,
    baseNoiseType: 'perlin' as const,
    enableDomainWarping: false,
    enableAntiAliasing: true,
    enableSpectralControl: true,
    enableClamping: true,
  }),

  /**
   * 構造物配置用ノイズ設定
   */
  createStructureNoise: () => ({
    frequency: 0.003,
    amplitude: 1.0,
    octaves: 2,
    persistence: 0.5,
    lacunarity: 2.0,
    seed: 24680n,
    gradientMode: 'improved' as const,
    interpolation: 'quintic' as const,
    enableVectorization: true,
  }),
} as const
