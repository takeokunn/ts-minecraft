/**
 * World Validation Domain Services
 */

export * from './consistency_checker.js'
export * from './generation_validator.js'
export * from './constraint_enforcer.js'

import { Layer } from 'effect'
import { ConsistencyCheckerServiceLive, ConsistencyCheckerService } from './consistency_checker.js'
import { GenerationValidatorServiceLive, GenerationValidatorService } from './generation_validator.js'
import { ConstraintEnforcerServiceLive, ConstraintEnforcerService } from './constraint_enforcer.js'

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