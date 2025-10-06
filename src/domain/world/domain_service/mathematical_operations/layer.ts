/**
 * Mathematical Operations Domain Services - Layer Definitions
 */

import { Layer } from 'effect'
import { CoordinateTransformServiceLive } from './coordinate_transform'
import { InterpolationServiceLive } from './interpolation_service'
import { StatisticalAnalyzerServiceLive } from './statistical_analyzer'

export const MathematicalOperationsLayer = Layer.mergeAll(
  InterpolationServiceLive,
  CoordinateTransformServiceLive,
  StatisticalAnalyzerServiceLive
)
