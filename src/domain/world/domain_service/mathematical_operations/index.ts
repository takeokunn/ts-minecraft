/**
 * Mathematical Operations Domain Services
 */

export * from './interpolation_service.js'
export * from './coordinate_transform.js'
export * from './statistical_analyzer.js'

import { Layer } from 'effect'
import { InterpolationServiceLive, InterpolationService } from './interpolation_service.js'
import { CoordinateTransformServiceLive, CoordinateTransformService } from './coordinate_transform.js'
import { StatisticalAnalyzerServiceLive, StatisticalAnalyzerService } from './statistical_analyzer.js'

export const MathematicalOperationsLayer = Layer.mergeAll(
  InterpolationServiceLive,
  CoordinateTransformServiceLive,
  StatisticalAnalyzerServiceLive
)

export const MathematicalOperationsServices = {
  Interpolation: InterpolationService,
  CoordinateTransform: CoordinateTransformService,
  StatisticalAnalyzer: StatisticalAnalyzerService,
} as const