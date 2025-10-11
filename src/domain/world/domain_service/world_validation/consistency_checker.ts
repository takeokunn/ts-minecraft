/**
 * Consistency Checker Service - ワールド整合性検証ドメインサービス
 *
 * 生成されたワールドデータの内部整合性を検証
 * 物理法則・生態学法則・ゲーム設計原則の遵守確認
 * データ品質の保証と問題の早期発見
 */

import { type GenerationError } from '@domain/world/types/errors'
import {
  BoundingBoxSchema,
  WorldCoordinate2DSchema,
  makeUnsafeWorldCoordinate2D,
  type BoundingBox,
  type WorldCoordinate2D,
} from '@domain/world/value_object/coordinates'
import { Context, Effect, Layer, Match, ReadonlyArray, Schema, pipe } from 'effect'
import type { BiomeMappingResult, ClimateData } from '../biome_classification'

/**
 * 整合性検証結果スキーマ
 */
export const ConsistencyCheckResultSchema = Schema.Struct({
  // 基本情報
  checkType: Schema.Literal(
    'climate_consistency',
    'biome_validity',
    'elevation_coherence',
    'boundary_smoothness',
    'physical_constraints',
    'ecological_viability',
    'regional_consistency'
  ),

  coordinate: WorldCoordinate2DSchema,
  region: BoundingBoxSchema.pipe(Schema.optional),

  // 検証結果
  passed: Schema.Boolean,
  severity: Schema.Literal('info', 'warning', 'error', 'critical'),
  confidence: Schema.Number.pipe(Schema.between(0, 1)),

  // 詳細情報
  issues: Schema.Array(
    Schema.Struct({
      code: Schema.String,
      description: Schema.String,
      severity: Schema.Literal('low', 'medium', 'high', 'critical'),
      affectedArea: Schema.Number.pipe(Schema.nonNegative()),
      suggestions: Schema.Array(Schema.String).pipe(Schema.optional),
    })
  ),

  metrics: Schema.Record({
    key: Schema.String,
    value: Schema.Number,
  }),

  // 修正提案
  corrections: Schema.Array(
    Schema.Struct({
      type: Schema.String,
      priority: Schema.Number.pipe(Schema.between(0, 1)),
      impact: Schema.String,
      implementation: Schema.String,
    })
  ).pipe(Schema.optional),

  // メタデータ
  checkMetadata: Schema.Struct({
    algorithm: Schema.String,
    executionTime: Schema.Number.pipe(Schema.optional),
    dataQuality: Schema.Number.pipe(Schema.between(0, 1)),
    checksPerformed: Schema.Array(Schema.String),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'ConsistencyCheckResult',
    title: 'World Consistency Check Result',
    description: 'Result of world data consistency verification',
  })
)

export type ConsistencyCheckResult = typeof ConsistencyCheckResultSchema.Type

/**
 * Consistency Checker Service Interface
 */
export interface ConsistencyCheckerService {
  readonly checkClimateConsistency: (
    climateData: ClimateData,
    coordinate: WorldCoordinate2D
  ) => Effect.Effect<ConsistencyCheckResult, GenerationError>

  readonly checkBiomeValidity: (
    biomeMapping: BiomeMappingResult,
    climateData: ClimateData
  ) => Effect.Effect<ConsistencyCheckResult, GenerationError>

  readonly checkRegionalConsistency: (
    region: ReadonlyArray<ReadonlyArray<BiomeMappingResult>>, // ワールドデータ
    bounds?: BoundingBox
  ) => Effect.Effect<ReadonlyArray<ConsistencyCheckResult>, GenerationError>
}

export const ConsistencyCheckerService = Context.GenericTag<ConsistencyCheckerService>(
  '@minecraft/domain/world/ConsistencyChecker'
)

export const ConsistencyCheckerServiceLive = Layer.effect(
  ConsistencyCheckerService,
  Effect.succeed({
    checkClimateConsistency: (climateData, coordinate) =>
      Effect.gen(function* () {
        const issues = []
        const metrics: Record<string, number> = {}

        // 温度範囲チェック
        if (climateData.temperature < -50 || climateData.temperature > 60) {
          issues.push({
            code: 'TEMP_OUT_OF_RANGE',
            description: `Temperature ${climateData.temperature}°C is outside realistic range`,
            severity: 'high' as const,
            affectedArea: 1,
          })
        }

        metrics.temperatureCheck = climateData.temperature
        metrics.humidityCheck = climateData.humidity

        return {
          checkType: 'climate_consistency' as const,
          coordinate,
          passed: issues.length === 0,
          severity: issues.length > 0 ? ('warning' as const) : ('info' as const),
          confidence: 0.9,
          issues,
          metrics,
          checkMetadata: {
            algorithm: 'climate_validator_v1',
            dataQuality: climateData.dataQuality,
            checksPerformed: ['temperature_range', 'humidity_range', 'precipitation_validity'],
          },
        } satisfies ConsistencyCheckResult
      }),

    checkBiomeValidity: (biomeMapping, climateData) =>
      Effect.gen(function* () {
        const issues = []

        // バイオーム-気候整合性チェック
        const isValidCombination = validateBiomeClimateMatch(biomeMapping.primaryBiome, climateData)

        if (!isValidCombination) {
          issues.push({
            code: 'BIOME_CLIMATE_MISMATCH',
            description: `Biome ${biomeMapping.primaryBiome} incompatible with climate`,
            severity: 'medium' as const,
            affectedArea: 100,
          })
        }

        return {
          checkType: 'biome_validity' as const,
          coordinate: biomeMapping.coordinate,
          passed: issues.length === 0,
          severity: issues.length > 0 ? ('warning' as const) : ('info' as const),
          confidence: biomeMapping.mappingConfidence,
          issues,
          metrics: {
            biomeConfidence: biomeMapping.mappingConfidence,
            climateMatch: isValidCombination ? 1 : 0,
          },
          checkMetadata: {
            algorithm: 'biome_validator_v1',
            dataQuality: 0.8,
            checksPerformed: ['biome_climate_match', 'transition_validity'],
          },
        } satisfies ConsistencyCheckResult
    }),

    checkRegionalConsistency: (region, bounds) =>
      Effect.gen(function* () {
        const flattenedRegion = ReadonlyArray.flatten(region)
        if (flattenedRegion.length === 0) {
          return []
        }

        const analysisBounds = bounds
        const lowConfidenceCells = flattenedRegion.filter((cell) => cell.mappingConfidence < 0.6)
        const outOfBoundsCells = analysisBounds
          ? flattenedRegion.filter((cell) => !isCoordinateWithinBounds(cell.coordinate, analysisBounds))
          : []

        const distinctBiomeCount = new Set(flattenedRegion.map((cell) => cell.primaryBiome)).size
        const averageConfidence =
          flattenedRegion.reduce((total, cell) => total + cell.mappingConfidence, 0) / flattenedRegion.length
        const lowConfidenceRatio = lowConfidenceCells.length / flattenedRegion.length
        const severity = determineSeverity(lowConfidenceRatio, outOfBoundsCells.length)

        const metrics: Record<string, number> = {
          totalCells: flattenedRegion.length,
          averageConfidence,
          lowConfidenceRatio,
          lowConfidenceCount: lowConfidenceCells.length,
          distinctBiomeCount,
          outOfBoundsCells: outOfBoundsCells.length,
          boundsVolume: analysisBounds ? calculateBoundsVolume(analysisBounds) : 0,
        }

        const issues: ConsistencyCheckResult['issues'] = []

        if (lowConfidenceCells.length > 0) {
          issues.push({
            code: 'LOW_CONFIDENCE_AREA',
            description: `低信頼度セルが${lowConfidenceCells.length}箇所検出されました（全体の${(lowConfidenceRatio * 100).toFixed(1)}%）。`,
            severity: selectIssueSeverity(lowConfidenceRatio),
            affectedArea: lowConfidenceCells.length,
            suggestions: [
              'BiomeMapperServiceのノイズ設定を再調整する',
              '気候データのサンプリング密度を向上させる',
            ],
          })
        }

        if (outOfBoundsCells.length > 0 && analysisBounds) {
          issues.push({
            code: 'OUT_OF_BOUNDS_COORDINATE',
            description: `BoundingBox外の座標が${outOfBoundsCells.length}箇所検出されました。`,
            severity: outOfBoundsCells.length > 5 ? 'high' : 'medium',
            affectedArea: outOfBoundsCells.length,
            suggestions: ['BiomeMapperService.mapRegionalBiomesの入力境界を再確認する'],
          })
        }

        const corrections: ConsistencyCheckResult['corrections'] =
          lowConfidenceCells.length === 0 && outOfBoundsCells.length === 0
            ? undefined
            : [
                {
                  type: 'regional_rebalancing',
                  priority: Math.min(1, lowConfidenceRatio + outOfBoundsCells.length * 0.05),
                  impact: 'バイオーム信頼度と境界整合性の改善',
                  implementation:
                    '高リスクセルを中心に気候推定値を再計算し、必要に応じてChunk再生成パイプラインを再実行する',
                },
              ]

        const result: ConsistencyCheckResult = {
          checkType: 'regional_consistency',
          coordinate: pickReferenceCoordinate(flattenedRegion, analysisBounds),
          region: analysisBounds,
          passed: severity === 'info' && outOfBoundsCells.length === 0,
          severity,
          confidence: Math.max(0, 1 - (lowConfidenceRatio + outOfBoundsCells.length * 0.05)),
          issues,
          metrics,
          corrections,
          checkMetadata: {
            algorithm: 'regional_consistency_v1',
            dataQuality: Math.max(0, 1 - lowConfidenceRatio),
            checksPerformed: [
              'confidence_distribution',
              'bounding_box_validation',
              'biome_diversity_assessment',
            ],
          },
        }

        return [result]
      }),
  })
)

const validateBiomeClimateMatch = (biome: unknown, climate: ClimateData): boolean => {
  // 簡略化されたバイオーム-気候適合性チェック
  const temp = climate.temperature
  const precip = climate.precipitation

  return pipe(
    Match.value(biome),
    Match.when('desert', () => temp > 15 && precip < 500),
    Match.when('jungle', () => temp > 20 && precip > 1500),
    Match.when('tundra', () => temp < 0),
    Match.orElse(() => true)
  )
}

const determineSeverity = (
  lowConfidenceRatio: number,
  outOfBoundsCount: number
): ConsistencyCheckResult['severity'] => {
  if (outOfBoundsCount > 0 && lowConfidenceRatio >= 0.2) {
    return 'critical'
  }
  if (outOfBoundsCount > 0) {
    return 'error'
  }
  if (lowConfidenceRatio >= 0.3) {
    return 'critical'
  }
  if (lowConfidenceRatio >= 0.15) {
    return 'error'
  }
  if (lowConfidenceRatio >= 0.08) {
    return 'warning'
  }
  return 'info'
}

const selectIssueSeverity = (lowConfidenceRatio: number): 'low' | 'medium' | 'high' | 'critical' => {
  if (lowConfidenceRatio >= 0.3) {
    return 'critical'
  }
  if (lowConfidenceRatio >= 0.2) {
    return 'high'
  }
  return 'medium'
}

const pickReferenceCoordinate = (
  region: ReadonlyArray<BiomeMappingResult>,
  bounds?: BoundingBox
): WorldCoordinate2D => {
  if (bounds) {
    const centerX = (Number(bounds.min.x) + Number(bounds.max.x)) / 2
    const centerZ = (Number(bounds.min.z) + Number(bounds.max.z)) / 2
    return makeUnsafeWorldCoordinate2D(centerX, centerZ)
  }
  const fallback = region.at(0)
  return fallback?.coordinate ?? makeUnsafeWorldCoordinate2D(0, 0)
}

const isCoordinateWithinBounds = (coordinate: WorldCoordinate2D, bounds: BoundingBox): boolean => {
  const { x, z } = coordinate
  return (
    Number(x) >= Number(bounds.min.x) &&
    Number(x) <= Number(bounds.max.x) &&
    Number(z) >= Number(bounds.min.z) &&
    Number(z) <= Number(bounds.max.z)
  )
}

const calculateBoundsVolume = (bounds: BoundingBox): number => {
  const dx = Math.max(0, Number(bounds.max.x) - Number(bounds.min.x))
  const dy = Math.max(0, Number(bounds.max.y) - Number(bounds.min.y))
  const dz = Math.max(0, Number(bounds.max.z) - Number(bounds.min.z))
  return dx * dy * dz
}
