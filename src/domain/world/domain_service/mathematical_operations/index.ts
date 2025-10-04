/**
 * Mathematical Operations Domain Services
 */

export * from './coordinate_transform.js'
export * from './interpolation_service.js'
export * from './statistical_analyzer.js'

import { Layer } from 'effect'
import { CoordinateTransformService, CoordinateTransformServiceLive } from './coordinate_transform.js'
import { InterpolationService, InterpolationServiceLive } from './interpolation_service.js'
import { StatisticalAnalyzerService, StatisticalAnalyzerServiceLive } from './statistical_analyzer.js'

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
