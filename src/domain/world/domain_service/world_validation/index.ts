/**
 * World Validation Domain Services
 */

export * from './index'
export * from './index'
export * from './index'

import { Layer } from 'effect'
import { ConsistencyCheckerService, ConsistencyCheckerServiceLive } from './index'
import { ConstraintEnforcerService, ConstraintEnforcerServiceLive } from './index'
import { GenerationValidatorService, GenerationValidatorServiceLive } from './index'

export const WorldValidationLayer = Layer.mergeAll(
  ConsistencyCheckerServiceLive,
  GenerationValidatorServiceLive,
  ConstraintEnforcerServiceLive
)

export const WorldValidationServices = {
  ConsistencyChecker: ConsistencyCheckerService,
  GenerationValidator: GenerationValidatorService,
  ConstraintEnforcer: ConstraintEnforcerService,
} as const
