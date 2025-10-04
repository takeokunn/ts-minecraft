/**
 * Mathematical Operations Domain Services
 */

export * from './interpolation-service.js'
export * from './coordinate-transform.js'
export * from './statistical-analyzer.js'

import { Layer } from 'effect'
import { InterpolationServiceLive, InterpolationService } from './interpolation-service.js'
import { CoordinateTransformServiceLive, CoordinateTransformService } from './coordinate-transform.js'
import { StatisticalAnalyzerServiceLive, StatisticalAnalyzerService } from './statistical-analyzer.js'

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