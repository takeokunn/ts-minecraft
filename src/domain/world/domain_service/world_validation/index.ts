/**
 * World Validation Domain Services
 */

export * from './consistency_checker'
export * from './constraint_enforcer'
export * from './generation_validator'
export * from './layer'

import { ConsistencyCheckerService } from './consistency_checker'
import { ConstraintEnforcerService } from './constraint_enforcer'
import { GenerationValidatorService } from './generation_validator'

export const WorldValidationServices = {
  ConsistencyChecker: ConsistencyCheckerService,
  GenerationValidator: GenerationValidatorService,
  ConstraintEnforcer: ConstraintEnforcerService,
} as const
