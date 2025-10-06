/**
 * Mathematical Operations Domain Services
 */

export * from './index'
export * from './index'
export * from './index'

import { Layer } from 'effect'
import { CoordinateTransformService, CoordinateTransformServiceLive } from './index'
import { InterpolationService, InterpolationServiceLive } from './index'
import { StatisticalAnalyzerService, StatisticalAnalyzerServiceLive } from './index'

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
