import { Schema } from 'effect'

/**
 * Noise Configuration Value Object - バレルエクスポート
 *
 * 数学的に正確なノイズパラメータの完全実装
 * フラクタル・周波数・振幅制御による高品質地形生成
 */

// ノイズ基本設定
export {
  AdvancedNoiseSettingsSchema,
  AmplitudeSchema,
  BasicNoiseSettingsSchema,
  CreateNoiseSettingsParamsSchema,
  FrequencySchema,
  InterpolationSchema,
  LacunaritySchema,
  makeUnsafeAmplitude,
  makeUnsafeFrequency,
  makeUnsafeLacunarity,
  makeUnsafeOctaves,
  makeUnsafePersistence,
  makeUnsafeScale,
  NOISE_PRESETS,
  NoiseDimensionSchema,
  NoiseQualitySchema,
  NoiseSettingsErrorSchema,
  NoiseTypeSchema,
  OctavesSchema,
  PersistenceSchema,
  ScaleSchema,
  type AdvancedNoiseSettings,
  type Amplitude,
  type BasicNoiseSettings,
  type CreateNoiseSettingsParams,
  type Frequency,
  type Interpolation,
  type Lacunarity,
  type NoiseDimension,
  type NoiseQuality,
  type NoiseSettingsError,
  type NoiseType,
  type Octaves,
  type Persistence,
  type Scale,
} from './noise_settings'

// オクターブ設定
export {
  CompleteOctaveConfigSchema,
  CreateOctaveConfigParamsSchema,
  IndividualOctaveConfigSchema,
  makeUnsafeOctaveIndex,
  makeUnsafePhase,
  makeUnsafeWeight,
  OCTAVE_OPTIMIZATION_HINTS,
  OCTAVE_PRESETS,
  OctaveCombinationSchema,
  OctaveConfigErrorSchema,
  OctaveIndexSchema,
  OctaveTypeSchema,
  PhaseSchema,
  WeightSchema,
  type CompleteOctaveConfig,
  type CreateOctaveConfigParams,
  type IndividualOctaveConfig,
  type OctaveCombination,
  type OctaveConfigError,
  type OctaveIndex,
  type OctaveType,
  type Phase,
  type Weight,
} from './octave_config'

// 周波数帯域設定
export {
  asFilterType,
  BandwidthSchema,
  CreateFrequencyBandsParamsSchema,
  FilterTypeSchema,
  FREQUENCY_BAND_PRESETS,
  FrequencyBandClassSchema,
  FrequencyBandCollectionSchema,
  FrequencyBandsErrorSchema,
  FrequencyValueSchema,
  GainSchema,
  IndividualFrequencyBandSchema,
  makeUnsafeBandwidth,
  makeUnsafeFrequencyValue,
  makeUnsafeGain,
  makeUnsafeQFactor,
  QFactorSchema,
  TERRAIN_FREQUENCY_MAPPING,
  type Bandwidth,
  type CreateFrequencyBandsParams,
  type FilterType,
  type FrequencyBandClass,
  type FrequencyBandCollection,
  type FrequencyBandsError,
  type FrequencyValue,
  type Gain,
  type IndividualFrequencyBand,
  type QFactor,
} from './frequency_bands'

// 振幅カーブ設定
export {
  AMPLITUDE_CURVE_PRESETS,
  AmplitudeCurveErrorSchema,
  AmplitudeCurveSchema,
  ControlPointSchema,
  ControlPointValueSchema,
  CreateAmplitudeCurveParamsSchema,
  CurveSegmentSchema,
  CurveTensionSchema,
  CurveTypeSchema,
  makeUnsafeControlPointValue,
  makeUnsafeNormalizedTime,
  NormalizedTimeSchema,
  SmoothingStrengthSchema,
  TERRAIN_AMPLITUDE_MAPPING,
  type AmplitudeCurve,
  type AmplitudeCurveError,
  type ControlPoint,
  type ControlPointValue,
  type CreateAmplitudeCurveParams,
  type CurveSegment,
  type CurveTension,
  type CurveType,
  type NormalizedTime,
  type SmoothingStrength,
} from './amplitude_curves'

/**
 * ノイズ設定ファクトリ
 */
export const NoiseConfigurationFactory = {
  /**
   * 地形生成用ノイズ設定作成
   */
  createTerrainNoise: (): AdvancedNoiseSettings => {
    return createTerrainNoiseConfig()
  },

  /**
   * 洞窟生成用ノイズ設定作成
   */
  createCaveNoise: (): AdvancedNoiseSettings => {
    return createCaveNoiseConfig()
  },

  /**
   * 温度マップ用ノイズ設定作成
   */
  createTemperatureNoise: (): BasicNoiseSettings => {
    return createTemperatureNoiseConfig()
  },

  /**
   * 湿度マップ用ノイズ設定作成
   */
  createHumidityNoise: (): BasicNoiseSettings => {
    return createHumidityNoiseConfig()
  },

  /**
   * 標準オクターブ設定作成
   */
  createStandardOctaves: (octaveCount: number): CompleteOctaveConfig => {
    return createStandardOctaveConfig(octaveCount)
  },

  /**
   * 地形用周波数帯域作成
   */
  createTerrainFrequencyBands: (): FrequencyBandCollection => {
    return createTerrainFrequencyBands()
  },

  /**
   * 標準振幅カーブ作成
   */
  createStandardAmplitudeCurve: (preset: keyof typeof AMPLITUDE_CURVE_PRESETS): AmplitudeCurve => {
    return createAmplitudeCurveFromPreset(preset)
  },
} as const

/**
 * ノイズ設定定数
 */
export const NoiseConfigurationConstants = {
  /**
   * 標準周波数値
   */
  FREQUENCIES: {
    CONTINENTAL: 0.0001,
    REGIONAL: 0.001,
    LOCAL: 0.01,
    DETAIL: 0.1,
    FINE: 1.0,
  },

  /**
   * 標準振幅値
   */
  AMPLITUDES: {
    LARGE_SCALE: 1000,
    MEDIUM_SCALE: 100,
    SMALL_SCALE: 10,
    FINE_SCALE: 1,
  },

  /**
   * 標準ラクナリティ
   */
  LACUNARITIES: {
    SMOOTH: 1.5,
    STANDARD: 2.0,
    ROUGH: 2.5,
    CHAOTIC: 3.0,
  },

  /**
   * 標準パーシスタンス
   */
  PERSISTENCES: {
    SMOOTH: 0.3,
    BALANCED: 0.5,
    DETAILED: 0.7,
    CHAOTIC: 0.9,
  },

  /**
   * 推奨オクターブ数
   */
  OCTAVE_COUNTS: {
    MINIMAL: 3,
    STANDARD: 6,
    DETAILED: 8,
    MAXIMUM: 12,
  },
} as const

/**
 * ノイズ設定検証
 */
export const NoiseConfigurationValidation = {
  /**
   * ノイズ設定の妥当性検証
   */
  validateNoiseSettings: (settings: BasicNoiseSettings): boolean => {
    return (
      settings.frequency > 0 &&
      settings.amplitude > 0 &&
      settings.octaves >= 1 &&
      settings.lacunarity >= 1.0 &&
      settings.persistence >= 0.0 &&
      settings.persistence <= 1.0
    )
  },

  /**
   * オクターブ設定の妥当性検証
   */
  validateOctaveConfig: (config: CompleteOctaveConfig): boolean => {
    return config.octaves.length > 0 && config.octaves.every((octave) => octave.weight >= 0 && octave.weight <= 1)
  },

  /**
   * 周波数帯域の重複チェック
   */
  checkFrequencyOverlap: (bands: IndividualFrequencyBand[]): boolean => {
    return bands.some((band1, i) =>
      bands.slice(i + 1).some((band2) => {
        const range1Min = band1.centerFrequency - band1.bandwidth / 2
        const range1Max = band1.centerFrequency + band1.bandwidth / 2
        const range2Min = band2.centerFrequency - band2.bandwidth / 2
        const range2Max = band2.centerFrequency + band2.bandwidth / 2

        return range1Max > range2Min && range2Max > range1Min
      })
    )
  },
} as const

const isBasicNoiseSettings = Schema.is(BasicNoiseSettingsSchema)
const isCompleteOctaveConfig = Schema.is(CompleteOctaveConfigSchema)
const isAmplitudeCurve = Schema.is(AmplitudeCurveSchema)

/**
 * 型ガード
 */
export const NoiseConfigurationTypeGuards = {
  /**
   * BasicNoiseSettingsの型ガード
   */
  isBasicNoiseSettings,

  /**
   * CompleteOctaveConfigの型ガード
   */
  isCompleteOctaveConfig,

  /**
   * AmplitudeCurveの型ガード
   */
  isAmplitudeCurve,
} as const

/**
 * 内部ヘルパー関数（簡略実装）
 */

function createTerrainNoiseConfig(): AdvancedNoiseSettings {
  const preset = NOISE_PRESETS.TERRAIN
  return {
    type: 'perlin',
    dimension: 3,
    quality: 'standard',
    frequency: makeUnsafeFrequency(preset.frequency),
    amplitude: makeUnsafeAmplitude(preset.amplitude),
    scale: makeUnsafeScale(1.0),
    octaves: makeUnsafeOctaves(preset.octaves),
    lacunarity: makeUnsafeLacunarity(preset.lacunarity),
    persistence: makeUnsafePersistence(preset.persistence),
    interpolation: 'quintic',
    offset: { x: 0, y: 0, z: 0 },
    outputRange: { min: -1, max: 1 },
    normalize: true,
    clamp: false,
  } as const satisfies AdvancedNoiseSettings
}

function createCaveNoiseConfig(): AdvancedNoiseSettings {
  const preset = NOISE_PRESETS.CAVES
  return {
    type: 'simplex',
    dimension: 3,
    quality: 'high',
    frequency: makeUnsafeFrequency(preset.frequency),
    amplitude: makeUnsafeAmplitude(preset.amplitude),
    scale: makeUnsafeScale(1.0),
    octaves: makeUnsafeOctaves(preset.octaves),
    lacunarity: makeUnsafeLacunarity(preset.lacunarity),
    persistence: makeUnsafePersistence(preset.persistence),
    interpolation: 'quintic',
    offset: { x: 0, y: 0, z: 0 },
    outputRange: { min: 0, max: 1 },
    normalize: true,
    clamp: true,
  } as const satisfies AdvancedNoiseSettings
}

function createTemperatureNoiseConfig(): BasicNoiseSettings {
  const preset = NOISE_PRESETS.TEMPERATURE
  return {
    type: 'perlin',
    dimension: 2,
    quality: 'standard',
    frequency: makeUnsafeFrequency(preset.frequency),
    amplitude: makeUnsafeAmplitude(preset.amplitude),
    scale: makeUnsafeScale(1.0),
    octaves: makeUnsafeOctaves(preset.octaves),
    lacunarity: makeUnsafeLacunarity(preset.lacunarity),
    persistence: makeUnsafePersistence(preset.persistence),
    interpolation: 'cosine',
    offset: { x: 0, y: 0 },
    outputRange: { min: -30, max: 50 },
    normalize: false,
    clamp: true,
  } as const satisfies BasicNoiseSettings
}

function createHumidityNoiseConfig(): BasicNoiseSettings {
  const preset = NOISE_PRESETS.HUMIDITY
  return {
    type: 'perlin',
    dimension: 2,
    quality: 'standard',
    frequency: makeUnsafeFrequency(preset.frequency),
    amplitude: makeUnsafeAmplitude(preset.amplitude),
    scale: makeUnsafeScale(1.0),
    octaves: makeUnsafeOctaves(preset.octaves),
    lacunarity: makeUnsafeLacunarity(preset.lacunarity),
    persistence: makeUnsafePersistence(preset.persistence),
    interpolation: 'cosine',
    offset: { x: 0, y: 0 },
    outputRange: { min: 0, max: 1 },
    normalize: true,
    clamp: true,
  } as const satisfies BasicNoiseSettings
}

function createStandardOctaveConfig(octaveCount: number): CompleteOctaveConfig {
  const octaves: IndividualOctaveConfig[] = Array.from({ length: octaveCount }, (_, i) => ({
    index: makeUnsafeOctaveIndex(i),
    type: 'base',
    enabled: true,
    frequency: Math.pow(2, i),
    amplitude: Math.pow(0.5, i),
    weight: makeUnsafeWeight(Math.pow(0.5, i)),
    phase: makeUnsafePhase(0),
    offset: { x: 0, y: 0, z: 0 },
  }))

  return {
    octaves,
    combination: {
      method: 'linear',
      normalization: {
        enabled: true,
        method: 'min_max',
      },
      weighting: {
        strategy: 'exponential',
      },
    },
    global: {
      baseLacunarity: 2.0,
      basePersistence: 0.5,
      autoCalculateWeights: true,
      autoNormalize: true,
      optimization: {
        skipZeroWeightOctaves: true,
        earlyTermination: true,
        maxContribution: 0.01,
      },
    },
  } as const satisfies CompleteOctaveConfig
}

function createTerrainFrequencyBands(): FrequencyBandCollection {
  const preset = FREQUENCY_BAND_PRESETS.STANDARD
  const bands = preset.bands.map((band, i) => ({
    id: `terrain_band_${i}`,
    name: band.name,
    class: 'mid' as const satisfies FrequencyBandClass,
    enabled: true,
    centerFrequency: makeUnsafeFrequencyValue(band.centerFreq),
    bandwidth: makeUnsafeBandwidth(band.bandwidth),
    gain: makeUnsafeGain(0),
    qFactor: makeUnsafeQFactor(1.0),
    filter: {
      type: asFilterType('bandpass'),
      order: 4,
      rolloff: 24,
    },
  }))

  return {
    bands,
    global: {
      masterGain: makeUnsafeGain(0),
      crossover: {
        enabled: true,
        type: 'linkwitz_riley',
        slope: 24,
      },
    },
  } as const satisfies FrequencyBandCollection
}

function createAmplitudeCurveFromPreset(preset: keyof typeof AMPLITUDE_CURVE_PRESETS): AmplitudeCurve {
  const presetData = AMPLITUDE_CURVE_PRESETS[preset]
  const controlPoints = presetData.points.map((point) => ({
    time: makeUnsafeNormalizedTime(point.time),
    value: makeUnsafeControlPointValue(point.value),
  }))

  return {
    id: `amplitude_curve_${preset}`,
    name: presetData.description,
    controlPoints,
    global: {
      defaultType: 'linear',
      inputRange: { min: 0, max: 1 },
      outputRange: {
        min: makeUnsafeControlPointValue(Math.min(...presetData.points.map((p) => p.value))),
        max: makeUnsafeControlPointValue(Math.max(...presetData.points.map((p) => p.value))),
      },
    },
  } as const satisfies AmplitudeCurve
}
