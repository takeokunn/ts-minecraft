/**
 * World Validation Domain Services - Layer Definitions
 */

import { Layer } from 'effect'
import { ConsistencyCheckerServiceLive } from './consistency_checker'
import { ConstraintEnforcerServiceLive } from './constraint_enforcer'
import { GenerationValidatorServiceLive } from './generation_validator'

export const WorldValidationLayer = Layer.mergeAll(
  ConsistencyCheckerServiceLive,
  GenerationValidatorServiceLive,
  ConstraintEnforcerServiceLive
)
