/**
 * World Validation Domain Services
 */

export * from './consistency_checker.js'
export * from './constraint_enforcer.js'
export * from './generation_validator.js'

import { Layer } from 'effect'
import { ConsistencyCheckerService, ConsistencyCheckerServiceLive } from './consistency_checker.js'
import { ConstraintEnforcerService, ConstraintEnforcerServiceLive } from './constraint_enforcer.js'
import { GenerationValidatorService, GenerationValidatorServiceLive } from './generation_validator.js'

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
