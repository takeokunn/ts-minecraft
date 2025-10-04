import { Layer } from 'effect'
import {
  CoordinateTransformService,
  makeCoordinateTransformService,
} from '@mc/bc-world/domain/domain_service/mathematical_operations/coordinate-transform'
import {
  InterpolationService,
  makeInterpolationService,
} from '@mc/bc-world/domain/domain_service/mathematical_operations/interpolation-service'
import {
  StatisticalAnalyzerService,
  makeStatisticalAnalyzerService,
} from '@mc/bc-world/domain/domain_service/mathematical_operations/statistical-analyzer'

export const CoordinateTransformLayer = Layer.succeed(
  CoordinateTransformService,
  makeCoordinateTransformService(),
)
export const InterpolationLayer = Layer.succeed(
  InterpolationService,
  makeInterpolationService(),
)
export const StatisticalAnalyzerLayer = Layer.succeed(
  StatisticalAnalyzerService,
  makeStatisticalAnalyzerService(),
)

export const MathematicalOperationsLayer = Layer.mergeAll(
  CoordinateTransformLayer,
  InterpolationLayer,
  StatisticalAnalyzerLayer,
)

export const MathematicalOperationsServices = {
  CoordinateTransform: CoordinateTransformService,
  Interpolation: InterpolationService,
  StatisticalAnalyzer: StatisticalAnalyzerService,
} as const
