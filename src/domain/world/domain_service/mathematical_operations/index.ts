/**
 * Mathematical Operations Domain Services
 */

export * from './coordinate_transform'
export * from './interpolation_service'
export * from './layer'
export * from './statistical_analyzer'

import { CoordinateTransformService } from './coordinate_transform'
import { InterpolationService } from './interpolation_service'
import { StatisticalAnalyzerService } from './statistical_analyzer'

export const MathematicalOperationsServices = {
  Interpolation: InterpolationService,
  CoordinateTransform: CoordinateTransformService,
  StatisticalAnalyzer: StatisticalAnalyzerService,
} as const
