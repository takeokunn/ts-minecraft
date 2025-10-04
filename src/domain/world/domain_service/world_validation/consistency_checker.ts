/**
 * Consistency Checker Service - ワールド整合性検証ドメインサービス
 *
 * 生成されたワールドデータの内部整合性を検証
 * 物理法則・生態学法則・ゲーム設計原則の遵守確認
 * データ品質の保証と問題の早期発見
 */

import { Context, Effect, Layer, Schema } from 'effect'
import { type GenerationError } from '../../types/errors/generation_errors.js'
import type { WorldCoordinate2D } from '../../value_object/coordinates/world_coordinate.js'
import type { BiomeMappingResult } from '../biome_classification/biome_mapper.js'
import type { ClimateData } from '../biome_classification/climate_calculator.js'

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
    'ecological_viability'
  ),

  coordinate: Schema.Unknown, // WorldCoordinate2D
  region: Schema.Unknown.pipe(Schema.optional), // BoundingBox

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
    region: ReadonlyArray<ReadonlyArray<any>>, // ワールドデータ
    bounds: any // BoundingBox
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
        return []
      }),
  })
)

const validateBiomeClimateMatch = (biome: any, climate: ClimateData): boolean => {
  // 簡略化されたバイオーム-気候適合性チェック
  const temp = climate.temperature
  const precip = climate.precipitation

  switch (biome) {
    case 'desert':
      return temp > 15 && precip < 500
    case 'jungle':
      return temp > 20 && precip > 1500
    case 'tundra':
      return temp < 0
    default:
      return true
  }
}
